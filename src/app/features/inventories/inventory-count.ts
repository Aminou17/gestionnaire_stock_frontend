import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
    viewChildren,
} from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { Inventory, InventoryItem } from "../../core/stock/inventory.model";
import { AuthService } from "../../core/auth/auth.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { Product } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { ScanButton } from "../../shared/scan-button/scan-button";
import { ToastService } from "../../shared/toast/toast.service";
import { CountSync, SaveState } from "./inventory-count-sync";
import { InventoryThumb } from "./inventory-thumb";

// Un produit du comptage : actualStock est ce que le serveur connaît (null : pas encore saisi)
type CountLine = Pick<InventoryItem, "productId" | "productName" | "image" | "actualStock">;

const RESULTS_LIMIT = 8;

const SAVE_LABELS: Record<SaveState, string> = {
    saved: "Enregistré",
    saving: "Enregistrement…",
    offline: "Hors ligne : sauvegardé sur l'appareil",
    error: "Non enregistré",
};

// Écran de comptage : on cherche ou on scanne chaque produit à compter, puis on saisit sa quantité.
// Tout est enregistré au fil de l'eau. Le stock du logiciel n'est jamais affiché ici,
// pour que le comptage reste honnête.
@Component({
    selector: "app-inventory-count",
    imports: [PageHeader, Icon, EmptyState, LoadError, PhotoZoom, ScanButton, InventoryThumb],
    providers: [CountSync],
    templateUrl: "./inventory-count.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-count.css"],
    host: {
        // Fermer l'onglet avec des saisies non envoyées : le navigateur prévient
        "(window:beforeunload)": "warnBeforeUnload($event)",
    },
})
export class InventoryCount {
    private inventoryService = inject(InventoryService);
    private productService = inject(ProductService);
    private router = inject(Router);
    private toast = inject(ToastService);
    protected auth = inject(AuthService);
    sync = inject(CountSync);

    protected id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    private inputs = viewChildren<ElementRef<HTMLInputElement>>("countInput");
    private searchBox = viewChild<ElementRef<HTMLInputElement>>("searchBox");
    private leaveDialog = viewChild.required<ElementRef<HTMLDialogElement>>("leave");

    // Le brouillon de l'appareil est renvoyé avant de lire la liste, pour ne rien rater
    private ready = signal(false);

    inventory = signal<Inventory | null>(null);

    // Les produits déjà choisis, lus une seule fois : un petit panier, jamais toute la boutique
    first = rxResource({
        params: () => (this.ready() ? { id: this.id() } : undefined),
        stream: ({ params }) =>
            this.inventoryService.getInventory(params.id, {
                filter: "all",
                search: "",
                page: 1,
                limit: 500,
            }),
    });

    // La liste affichée : le dernier produit ajouté est en haut
    lines = signal<CountLine[]>([]);

    // Recherche : ce que la personne tape, envoyé une fois la frappe terminée
    query = signal("");
    private typing: ReturnType<typeof setTimeout> | undefined;

    results = rxResource({
        params: () => this.query() || undefined,
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params,
                categoryId: null,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: RESULTS_LIMIT,
            }),
    });
    found = computed(() => (this.results.hasValue() ? this.results.value().data : []));

    private scanQueue: Promise<void> = Promise.resolve();
    flash = signal<number | null>(null);
    zoom = signal<{ src: string; name: string } | null>(null);

    // Fenêtres « quitter ? » et « terminer ? »
    private leaving: ((leave: boolean) => void) | null = null;
    private finished = false;
    closing = signal(false);
    closeError = signal("");

    // Seuls les produits dont la quantité est saisie comptent
    counted = computed(() => this.lines().filter((line) => this.value(line) !== null).length);
    withoutQuantity = computed(() => this.lines().length - this.counted());

    saveLabel = computed(() => SAVE_LABELS[this.sync.state()]);

    constructor() {
        this.sync.onSaved = (inventory, sent) => {
            this.inventory.set(inventory);

            // Les lignes affichées prennent ce que le serveur sait maintenant
            this.lines.update((lines) =>
                lines.map((line) =>
                    sent[line.productId] === undefined
                        ? line
                        : { ...line, actualStock: sent[line.productId] },
                ),
            );
        };

        void this.sync.start(this.id()).then(() => this.ready.set(true));

        effect(() => {
            if (!this.first.hasValue()) return;
            const detail = this.first.value();

            untracked(() => {
                this.inventory.set(detail);

                // Les produits ajoutés depuis l'ouverture de la page restent en haut
                const known = new Set(this.lines().map((line) => line.productId));
                const loaded = [...detail.items]
                    .sort((a, b) => (b.countedAt ?? "").localeCompare(a.countedAt ?? ""))
                    .filter((item) => !known.has(item.productId));
                this.lines.update((lines) => [...lines, ...loaded]);

                // Un comptage clos ne se saisit plus : on va à la fiche
                if (detail.status !== "in_progress" && !this.finished) {
                    this.finished = true;
                    this.router.navigate(["/inventories", detail.id], { replaceUrl: true });
                }
            });
        });
    }

    // Valeur affichée : la saisie en attente, sinon ce que le serveur a
    value(line: CountLine): number | null {
        const pending = this.sync.pending()[line.productId];
        return pending !== undefined ? pending : line.actualStock;
    }

    setCount(line: CountLine, value: number | null) {
        const max = this.inventory()?.maxStock ?? 1_000_000;

        if (value === null) {
            // Un produit que le serveur ne connaît pas n'a rien à retirer
            if (line.actualStock !== null) this.sync.set(line.productId, null);
            else this.sync.forget(line.productId);
            return;
        }

        this.sync.set(line.productId, Math.min(Math.max(value, 0), max));
    }

    stepBy(line: CountLine, delta: number) {
        this.setCount(line, (this.value(line) ?? 0) + delta);
    }

    onInput(line: CountLine, event: Event) {
        const field = event.target as HTMLInputElement;
        const digits = field.value.replace(/\D/g, "").slice(0, 7);

        // Seuls les chiffres sont gardés
        if (digits !== field.value) field.value = digits;
        this.setCount(line, digits === "" ? null : Number(digits));
    }

    selectAll(event: Event) {
        (event.target as HTMLInputElement).select();
    }

    // Entrée passe au produit suivant de la liste
    focusNext(event: Event) {
        event.preventDefault();

        const fields = this.inputs()
            .map((ref) => ref.nativeElement)
            .sort((a, b) =>
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
            );
        const index = fields.indexOf(event.target as HTMLInputElement);
        const next = fields[index + 1];

        if (next) next.focus();
        else (event.target as HTMLInputElement).blur();
    }

    // Recherche

    onSearch(value: string) {
        clearTimeout(this.typing);
        this.typing = setTimeout(() => this.query.set(value.trim()), 250);
    }

    // Entrée dans la recherche : un code-barres exact ou un résultat unique est ajouté
    onEnter(typed: string) {
        const list = this.found();
        const match = list.find((product) => product.barcode === typed.trim()) ?? list[0];

        if (match && (match.barcode === typed.trim() || list.length === 1)) this.pick(match);
    }

    clearSearch() {
        clearTimeout(this.typing);
        this.query.set("");

        const box = this.searchBox();
        if (box) box.nativeElement.value = "";
    }

    // Ajouter un produit

    isListed(product: Product) {
        return this.lines().some((line) => line.productId === product.id);
    }

    // Toucher un résultat : le produit entre dans la liste, sa quantité est prête à saisir
    pick(product: Product) {
        const exists = this.isListed(product);

        this.clearSearch();
        if (!exists) this.addLine(product);

        this.highlight(product.id, true);
    }

    private addLine(product: Product): CountLine {
        const line: CountLine = {
            productId: product.id,
            productName: product.name,
            image: product.image ?? null,
            actualStock: null,
        };

        this.lines.update((lines) => [line, ...lines]);
        return line;
    }

    // Un scan compte +1, même la première fois. Les scans s'enchaînent un par un
    // pour que deux scans rapprochés ne se marchent pas dessus.
    onScan(code: string) {
        this.scanQueue = this.scanQueue.then(() => this.handleScan(code));
    }

    private async handleScan(code: string) {
        let product: Product | undefined;

        try {
            const page = await firstValueFrom(
                this.productService.getProducts({
                    search: code,
                    categoryId: null,
                    stockStatus: null,
                    status: "active",
                    page: 1,
                    limit: 2,
                }),
            );
            product = page.data.find((p) => p.barcode === code) ?? page.data[0];
        } catch {
            this.toast.show("Le scan n'a pas pu être traité.");
            return;
        }

        if (!product) {
            this.toast.show("Aucun produit ne porte ce code.");
            return;
        }

        const known = this.lines().find((line) => line.productId === product.id);
        let line: CountLine;

        if (known) {
            // Le produit déjà dans la liste remonte en haut
            line = known;
            this.lines.update((lines) => [known, ...lines.filter((l) => l !== known)]);
        } else {
            line = this.addLine(product);
        }

        this.setCount(line, (this.value(line) ?? 0) + 1);
        this.highlight(product.id, false);
    }

    // Met la ligne en avant ; après une recherche, le curseur arrive dans sa quantité
    private highlight(productId: number, focus: boolean) {
        this.flash.set(productId);
        setTimeout(() => this.flash.set(null), 1200);

        setTimeout(() => {
            const row = document.getElementById(`count-line-${productId}`);
            row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            if (focus) row?.querySelector<HTMLInputElement>("input.count")?.focus();
        });
    }

    // Retirer un produit du comptage
    removeLine(line: CountLine) {
        this.lines.update((lines) => lines.filter((l) => l !== line));

        if (line.actualStock !== null) this.sync.set(line.productId, null);
        else this.sync.forget(line.productId);
    }

    // Terminer : on envoie d'abord les dernières saisies, puis on clôture sans autre question
    async finish() {
        if (this.closing()) return;
        this.closeError.set("");

        const sent = await this.sync.flush();
        if (!sent) {
            this.closeError.set("Les dernières saisies ne sont pas encore envoyées. Réessayez.");
            return;
        }

        this.closing.set(true);

        this.inventoryService.close(this.id()).subscribe({
            next: async () => {
                this.finished = true;
                await this.sync.clearDraft();
                this.toast.show("Comptage terminé");
                this.router.navigate(["/inventories", this.id()], { replaceUrl: true });
            },
            error: (err: HttpErrorResponse) => {
                this.closing.set(false);
                this.closeError.set(err.error?.message ?? "Le comptage n'a pas pu être terminé.");
            },
        });
    }

    // Quitter la page : les saisies sont d'abord envoyées ; s'il en reste, on demande
    async canLeave() {
        if (this.finished) return true;

        await this.sync.flush();
        if (this.sync.pendingCount() === 0) return true;

        return new Promise<boolean>((resolve) => {
            this.leaving = resolve;
            this.leaveDialog().nativeElement.showModal();
        });
    }

    answerLeave(leave: boolean) {
        this.leaveDialog().nativeElement.close();
        this.leaving?.(leave);
        this.leaving = null;
    }

    warnBeforeUnload(event: BeforeUnloadEvent) {
        if (this.sync.pendingCount() > 0) event.preventDefault();
    }
}

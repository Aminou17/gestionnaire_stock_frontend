import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    linkedSignal,
    signal,
    untracked,
    viewChild,
    viewChildren,
} from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { Inventory, InventoryItem, PageInfo } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { ScanButton } from "../../shared/scan-button/scan-button";
import { ToastService } from "../../shared/toast/toast.service";
import { CountSync, SaveState } from "./inventory-count-sync";
import { InventoryThumb } from "./inventory-thumb";

type Tab = "uncounted" | "counted";

const PAGE_SIZE = 50;

const SAVE_LABELS: Record<SaveState, string> = {
    saved: "Enregistré",
    saving: "Enregistrement…",
    offline: "Hors ligne : sauvegardé sur l'appareil",
    error: "Non enregistré",
};

// Écran de comptage : on saisit la quantité de chaque produit, tout est enregistré au fil de l'eau.
// Le stock du logiciel n'est jamais affiché ici, pour que le comptage reste honnête.
@Component({
    selector: "app-inventory-count",
    imports: [
        NgTemplateOutlet,
        PageHeader,
        Icon,
        EmptyState,
        LoadError,
        PhotoZoom,
        ScanButton,
        InventoryThumb,
    ],
    providers: [CountSync],
    templateUrl: "./inventory-count.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-count.css"],
    host: {
        // fermer l'onglet avec des saisies non envoyées : le navigateur prévient
        "(window:beforeunload)": "warnBeforeUnload($event)",
    },
})
export class InventoryCount {
    private inventoryService = inject(InventoryService);
    private router = inject(Router);
    private toast = inject(ToastService);
    sync = inject(CountSync);

    protected id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    // la recherche d'une personne qui arrive depuis la fiche (?q=nom du produit)
    protected initialQuery = inject(ActivatedRoute).snapshot.queryParamMap.get("q") ?? "";

    private inputs = viewChildren<ElementRef<HTMLInputElement>>("countInput");
    private leaveDialog = viewChild.required<ElementRef<HTMLDialogElement>>("leave");
    private scannedBox = viewChild<ElementRef<HTMLElement>>("scannedBox");

    screen = signal<"count" | "review">("count");
    tab = signal<Tab>("uncounted");
    // ce que la personne tape ; la recherche n'est envoyée qu'une fois la frappe terminée
    query = signal(this.initialQuery);
    private typing: ReturnType<typeof setTimeout> | undefined;

    inventory = signal<Inventory | null>(null);

    // première page de la liste ; elle se recharge quand l'onglet ou la recherche change
    first = rxResource({
        params: () => ({ id: this.id(), tab: this.tab(), search: this.query() }),
        stream: ({ params }) =>
            this.inventoryService.getInventory(params.id, {
                filter: params.tab,
                search: params.search,
                page: 1,
                limit: PAGE_SIZE,
            }),
    });

    lines = linkedSignal<InventoryItem[]>(() =>
        this.first.hasValue() ? this.first.value().items : [],
    );
    private pageInfo = linkedSignal<PageInfo | null>(() =>
        this.first.hasValue() ? this.first.value().pagination : null,
    );

    loadingMore = signal(false);
    moreError = signal(false);

    // dernier produit scanné : mis en avant au-dessus de la liste
    scanned = signal<InventoryItem | null>(null);
    private scanQueue: Promise<void> = Promise.resolve();
    private lastScanned = "";
    flash = signal<number | null>(null);

    zoom = signal<{ src: string; name: string } | null>(null);

    // fenêtre « quitter ? » et fin du comptage
    private leaving: ((leave: boolean) => void) | null = null;
    private finished = false;

    // vérification avant de terminer
    countZero = signal(false);
    previewNames = signal<string[]>([]);
    closing = signal(false);
    closeError = signal("");

    private byProduct = computed(() => {
        const map = new Map<number, InventoryItem>();
        for (const line of this.lines()) map.set(line.productId, line);

        const scanned = this.scanned();
        if (scanned) map.set(scanned.productId, scanned);
        return map;
    });

    // produits comptés : le chiffre du serveur, corrigé des saisies pas encore envoyées
    counted = computed(() => {
        const inventory = this.inventory();
        if (!inventory) return 0;

        let count = inventory.countedCount;
        for (const [id, value] of Object.entries(this.sync.pending())) {
            const line = this.byProduct().get(Number(id));
            if (!line) continue;
            if (value !== null && !line.counted) count++;
            if (value === null && line.counted) count--;
        }
        return count;
    });

    total = computed(() => this.inventory()?.itemsCount ?? 0);
    remaining = computed(() => this.total() - this.counted());
    percent = computed(() => (this.total() === 0 ? 0 : (this.counted() / this.total()) * 100));

    saveLabel = computed(() => SAVE_LABELS[this.sync.state()]);

    // la liste sans le produit scanné, déjà montré au-dessus
    visibleLines = computed(() => {
        const scanned = this.scanned()?.productId;
        return this.lines().filter((line) => line.productId !== scanned);
    });

    hasMore = computed(() => {
        const info = this.pageInfo();
        return info !== null && info.page < info.totalPages;
    });

    constructor() {
        this.sync.onSaved = (inventory, sent) => {
            this.inventory.set(inventory);

            // les lignes affichées prennent ce que le serveur sait maintenant
            const update = (line: InventoryItem) =>
                sent[line.productId] === undefined
                    ? line
                    : {
                          ...line,
                          counted: sent[line.productId] !== null,
                          actualStock: sent[line.productId],
                      };
            this.lines.update((lines) => lines.map(update));
            this.scanned.update((line) => (line ? update(line) : line));
        };

        void this.sync.start(this.id());

        // l'inventaire garde son dernier état quand la liste se recharge
        effect(() => {
            if (!this.first.hasValue()) return;
            const detail = this.first.value();

            untracked(() => {
                this.inventory.set(detail);
                // un comptage clos ne se saisit plus : on va à la fiche
                if (detail.status !== "in_progress" && !this.finished) {
                    this.finished = true;
                    this.router.navigate(["/inventories", detail.id], { replaceUrl: true });
                }
            });
        });
    }

    // valeur affichée : la saisie en attente, sinon ce que le serveur a
    value(line: InventoryItem): number | null {
        const pending = this.sync.pending()[line.productId];
        return pending !== undefined ? pending : line.actualStock;
    }

    isCounted(line: InventoryItem) {
        return this.value(line) !== null;
    }

    setCount(line: InventoryItem, value: number | null) {
        const max = this.inventory()?.maxStock ?? 1_000_000;

        if (value === null) {
            // un produit jamais compté qu'on vide n'a rien à envoyer
            if (line.counted) this.sync.set(line.productId, null);
            else this.sync.forget(line.productId);
            return;
        }

        this.sync.set(line.productId, Math.min(Math.max(value, 0), max));
    }

    stepBy(line: InventoryItem, delta: number) {
        this.setCount(line, (this.value(line) ?? 0) + delta);
    }

    onInput(line: InventoryItem, event: Event) {
        const field = event.target as HTMLInputElement;
        const digits = field.value.replace(/\D/g, "").slice(0, 7);

        // seuls les chiffres sont gardés
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

    selectTab(tab: Tab) {
        this.tab.set(tab);
    }

    onSearch(value: string) {
        clearTimeout(this.typing);
        this.typing = setTimeout(() => this.query.set(value.trim()), 300);
    }

    // les lignes encore dans cet onglet côté serveur : la suite de la liste commence après elles
    async loadMore() {
        if (this.loadingMore()) return;

        this.loadingMore.set(true);
        this.moreError.set(false);

        const tab = this.tab();
        const stillInTab = this.lines().filter((line) => line.counted === (tab === "counted"));
        const page = Math.floor(stillInTab.length / PAGE_SIZE) + 1;

        try {
            const result = await firstValueFrom(
                this.inventoryService.getInventory(this.id(), {
                    filter: tab,
                    search: this.query(),
                    page,
                    limit: PAGE_SIZE,
                }),
            );

            // l'onglet a changé pendant le chargement : ce résultat ne correspond plus
            if (tab !== this.tab()) return;

            const known = new Set(this.lines().map((line) => line.productId));
            this.lines.update((lines) => [
                ...lines,
                ...result.items.filter((item) => !known.has(item.productId)),
            ]);
            this.pageInfo.set(result.pagination);
        } catch {
            this.moreError.set(true);
        } finally {
            this.loadingMore.set(false);
        }
    }

    // Un scan compte +1 sur le produit, même si c'est le premier. Les scans s'enchaînent
    // un par un pour que deux scans rapprochés ne se marchent pas dessus.
    onScan(code: string) {
        this.scanQueue = this.scanQueue.then(() => this.handleScan(code));
    }

    private async handleScan(code: string) {
        let line = code === this.lastScanned ? this.scanned() : null;

        if (!line) {
            try {
                const result = await firstValueFrom(
                    this.inventoryService.getInventory(this.id(), {
                        filter: "all",
                        search: code,
                        page: 1,
                        limit: 1,
                    }),
                );
                line = result.items[0] ?? null;
            } catch {
                this.toast.show("Le scan n'a pas pu être traité.");
                return;
            }
        }

        if (!line) {
            this.toast.show("Ce produit n'est pas dans ce comptage.");
            return;
        }

        this.lastScanned = code;
        this.scanned.set(line);
        this.setCount(line, (this.value(line) ?? 0) + 1);
        this.highlight(line.productId);
        setTimeout(() => this.scannedBox()?.nativeElement.scrollIntoView({ block: "center" }));
    }

    dismissScan() {
        this.scanned.set(null);
        this.lastScanned = "";
    }

    private highlight(productId: number) {
        this.flash.set(productId);
        setTimeout(() => this.flash.set(null), 1200);
    }

    // Terminer : on envoie d'abord les dernières saisies, puis on montre la vérification
    async review() {
        this.closeError.set("");

        const sent = await this.sync.flush();
        if (!sent) {
            this.closeError.set("Les dernières saisies ne sont pas encore envoyées. Réessayez.");
            return;
        }

        this.countZero.set(false);
        this.screen.set("review");
        window.scrollTo({ top: 0 });
        this.loadPreview();
    }

    // quelques noms de produits non comptés, pour que « il reste N produits » soit concret
    private loadPreview() {
        this.previewNames.set([]);
        if (this.remaining() === 0) return;

        this.inventoryService
            .getInventory(this.id(), { filter: "uncounted", search: "", page: 1, limit: 3 })
            .subscribe({
                next: (detail) => this.previewNames.set(detail.items.map((i) => i.productName)),
            });
    }

    backToCount() {
        this.screen.set("count");
    }

    close() {
        if (this.closing()) return;

        this.closing.set(true);
        this.closeError.set("");

        this.inventoryService.close(this.id(), this.countZero()).subscribe({
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

    // quitter la page : les saisies sont d'abord envoyées ; s'il en reste, on demande
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

import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    HostListener,
    computed,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { ADJUSTMENT_REASONS, AdjustmentDirection } from "../../../core/stock/stock-movement.model";
import { StockMovementService } from "../../../core/stock/stock-movement.service";
import { Icon } from "../../../shared/icon/icon";
import { ScanButton } from "../../../shared/scan-button/scan-button";
import { productInitials } from "../../products/product-look";

// couleur de la pastille de chaque motif
const REASON_TONES: Record<string, string> = {
    breakage: "warning",
    expired: "warning",
    theft: "danger",
    lost: "danger",
    correction: "neutral",
    other: "neutral",
    found: "success",
};

@Component({
    selector: "app-adjust-dialog",
    imports: [Icon, ScanButton],
    templateUrl: "./adjust-dialog.html",
    styleUrl: "./adjust-dialog.css",
})
export class AdjustDialog {
    private movementService = inject(StockMovementService);
    private productService = inject(ProductService);
    private destroyRef = inject(DestroyRef);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    // message prêt à afficher dans la page, par exemple : Stock ajusté, -2 Savon
    saved = output<string>();

    protected reasons = ADJUSTMENT_REASONS;
    protected initials = productInitials;
    protected tones = REASON_TONES;

    product = signal<Product | null>(null);
    search = signal("");
    // vide au départ : c'est l'utilisateur qui choisit retirer ou ajouter
    direction = signal<AdjustmentDirection | null>(null);
    quantity = signal<number | null>(null);
    reason = signal("");
    note = signal("");
    reasonOpen = signal(false);
    saving = signal(false);
    error = signal<string | null>(null);
    private open = signal(false);
    private searchTimer?: ReturnType<typeof setTimeout>;

    products = rxResource({
        params: () => (this.open() && !this.product() ? this.search() : undefined),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params,
                categoryId: null,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 8,
            }),
    });
    results = computed(() => (this.products.hasValue() ? this.products.value().data : []));

    validQuantity = computed(() => {
        const quantity = this.quantity();
        return quantity !== null && Number.isInteger(quantity) && quantity >= 1;
    });

    // une perte ne peut pas dépasser le stock
    tooMany = computed(() => {
        const product = this.product();
        return (
            this.direction() === "loss" &&
            !!product &&
            this.validQuantity() &&
            this.quantity()! > product.theoretical_stock
        );
    });

    stockAfter = computed(() => {
        const product = this.product();
        if (!product || !this.validQuantity()) return null;
        const change = this.direction() === "gain" ? this.quantity()! : -this.quantity()!;
        return product.theoretical_stock + change;
    });

    // un motif ou une note suffit pour enregistrer
    hasWhy = computed(() => !!this.reason() || !!this.note().trim());

    reasonLabel = computed(() => {
        const list = this.direction() ? this.reasons[this.direction()!] : [];
        return list.find((item) => item.value === this.reason())?.label ?? "";
    });

    notePlaceholder = computed(() =>
        this.direction() === "gain" ? "Ex. 5 bazins retrouvés au dépôt" : "Ex. 2 bazins tachés",
    );

    canSubmit = computed(
        () =>
            !!this.product() &&
            !!this.direction() &&
            this.validQuantity() &&
            this.hasWhy() &&
            !this.tooMany() &&
            !this.saving(),
    );

    // ce qui manque encore, affiché au-dessus du bouton tant qu'il est inactif
    missing = computed(() => {
        if (this.saving() || this.canSubmit()) return "";
        if (!this.product()) return "Choisissez un produit";
        if (!this.direction()) return "Dites si vous retirez ou ajoutez du stock";
        if (!this.validQuantity()) return "Indiquez la quantité";
        if (this.tooMany()) return "";
        return "Choisissez un motif ou écrivez une note";
    });

    // texte du bouton principal : dit exactement ce qui va se passer
    submitLabel = computed(() => {
        if (!this.direction()) return "Enregistrer";
        const gain = this.direction() === "gain";
        const action = gain ? "Ajouter" : "Retirer";
        const target = gain ? "au stock" : "du stock";
        return this.validQuantity()
            ? `${action} ${this.quantity()} ${target}`
            : `${action} ${target}`;
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            clearTimeout(this.searchTimer);
            if (this.open()) document.body.style.overflow = "";
        });
    }

    // product : produit déjà connu (ouverture depuis une fiche), sinon on le cherche ;
    // preset : valeurs déjà remplies, par exemple pour corriger une entrée de stock
    show(
        product: Product | null = null,
        preset: { direction?: AdjustmentDirection; quantity?: number; reason?: string } = {},
    ) {
        this.product.set(product);
        this.search.set("");
        this.direction.set(preset.direction ?? null);
        this.quantity.set(preset.quantity ?? null);
        this.reason.set(preset.reason ?? "");
        this.note.set("");
        this.reasonOpen.set(false);
        this.error.set(null);
        this.open.set(true);
        // la page derrière ne doit plus défiler
        document.body.style.overflow = "hidden";
        this.dialog().nativeElement.showModal();
    }

    changeProduct() {
        this.product.set(null);
        this.search.set("");
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    onClosed() {
        document.body.style.overflow = "";
        this.open.set(false);
    }

    onCancel(event: Event) {
        // Échap ferme d'abord le menu des motifs, pas la fenêtre
        if (this.reasonOpen()) {
            event.preventDefault();
            this.reasonOpen.set(false);
            return;
        }
        if (this.saving()) event.preventDefault();
    }

    // un clic en dehors du menu des motifs le referme
    @HostListener("document:click", ["$event"])
    onDocumentClick(event: Event) {
        if (!this.reasonOpen()) return;
        if (!(event.target as HTMLElement).closest(".reason-field")) {
            this.reasonOpen.set(false);
        }
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search.set(value), 300);
    }

    setDirection(direction: AdjustmentDirection) {
        if (this.direction() === direction) return;
        this.direction.set(direction);
        // les motifs ne sont pas les mêmes pour une perte et un gain
        this.reason.set("");
        this.reasonOpen.set(false);
    }

    chooseReason(value: string) {
        this.reason.set(value);
        this.reasonOpen.set(false);
    }

    // boutons moins et plus : la quantité part de 1 et ne descend pas en dessous
    step(change: number) {
        this.quantity.set(Math.max(1, (this.quantity() ?? 0) + change));
    }

    setQuantity(value: string) {
        this.quantity.set(value === "" ? null : Number(value));
    }

    submit() {
        const product = this.product();
        if (!this.canSubmit() || !product) return;

        const quantity = this.quantity()!;
        const direction = this.direction()!;
        const note = this.note().trim();

        this.saving.set(true);
        this.error.set(null);

        this.movementService
            .adjustStock({
                productId: product.id,
                direction,
                quantity,
                // sans motif choisi, la note seule suffit : le motif est alors Autre
                reason: this.reason() || "other",
                ...(note ? { note } : {}),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.dialog().nativeElement.close();
                    this.saved.emit(
                        `Stock ajusté : ${direction === "gain" ? "+" : "−"}${quantity} « ${product.name} ».`,
                    );
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible d'ajuster le stock.");
                },
            });
    }
}

import { DatePipe, DecimalPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ProductService } from "../../core/stock/product.service";
import { StockEntry, StockEntryPage } from "../../core/stock/stock-entry.model";
import { AdjustDialog } from "../stock-movements/adjust-dialog/adjust-dialog";
import { StockEntryService } from "../../core/stock/stock-entry.service";
import { SupplierService } from "../../core/stock/supplier.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";
import { BackState } from "../../core/back-link";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { categoryTone, productInitials } from "../products/product-look";
import { ToastService } from "../../shared/toast/toast.service";

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

@Component({
    selector: "app-stock-entries",
    imports: [
        RouterLink,
        DatePipe,
        DecimalPipe,
        PageHeader,
        PeriodFilter,
        Icon,
        ActionMenu,
        AdjustDialog,
        PhotoZoom,
        Pagination,
        EmptyState,
    ],
    templateUrl: "./stock-entries.html",
    styleUrl: "./stock-entries.css",
})
export class StockEntries {
    private entryService = inject(StockEntryService);
    private productService = inject(ProductService);
    private supplierService = inject(SupplierService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);

    zoomImage(event: Event, src: string, name: string) {
        // la photo ne doit pas ouvrir la fiche produit ni fermer la fenêtre
        event.preventDefault();
        event.stopPropagation();
        this.zoom.set({ src, name });
    }

    // la fiche produit ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Entrées de stock" };
    }
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);
    private adjustDialog = viewChild.required(AdjustDialog);

    protected initials = productInitials;
    protected tone = categoryTone;

    // menu des trois points d'une entrée
    protected rowActions: ActionItem[] = [
        { id: "product", label: "Voir le produit", icon: "package" },
        { id: "correct", label: "Corriger la quantité", icon: "edit" },
    ];

    // photo agrandie au centre de la page
    protected zoom = signal<{ src: string; name: string } | null>(null);

    // Liste

    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    // arrivée depuis la fiche d'un fournisseur : /stock-entries?supplierId=4
    supplierId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("supplierId")));
    page = signal(1);
    pageSize = storedPageSize("entries");

    entries = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            supplierId: this.supplierId(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) => this.entryService.getEntries(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<StockEntryPage | undefined, StockEntryPage | undefined>({
        source: () => (this.entries.hasValue() ? this.entries.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);

    // cartes du haut : une couleur et une icône par chiffre, comme les cartes de l'Accueil
    stats = computed(() => {
        const counters = this.counters();
        return [
            { label: "Entrées", value: counters?.entries, tone: "primary", icon: "stock-entry" },
            { label: "Unités reçues", value: counters?.units, tone: "success", icon: "package" },
            {
                label: "Produits approvisionnés",
                value: counters?.products,
                tone: "violet",
                icon: "tag",
            },
            { label: "Fournisseurs", value: counters?.suppliers, tone: "neutral", icon: "truck" },
        ] as const;
    });
    firstLoad = computed(() => this.entries.isLoading() && !this.last());
    filtered = computed(() => this.range().period !== "all" || this.supplierId() !== null);

    suppliers = rxResource({ stream: () => this.supplierService.getSuppliers() });
    supplierList = computed(() =>
        (this.suppliers.hasValue() ? this.suppliers.value() : []).filter((s) => s.is_active),
    );

    constructor() {
        // anciens liens (?productId=3, ?new=1) : la saisie a maintenant sa propre page
        const params = this.route.snapshot.queryParamMap;
        if (params.has("productId") || params.get("new") === "1") {
            this.router.navigate(["/stock-entries/new"], {
                queryParams: {
                    productId: params.get("productId"),
                    quantity: params.get("quantity"),
                    supplierId: params.get("supplierId"),
                },
                replaceUrl: true,
            });
        }

        // fournisseur de l'adresse inconnu ou supprimé : on montre toutes les entrées
        effect(() => {
            const id = this.supplierId();
            if (id === null || !this.suppliers.hasValue()) return;
            if (this.supplierList().some((s) => s.id === id)) return;

            this.supplierId.set(null);
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { supplierId: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
            });
        });
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectSupplier(value: string) {
        this.supplierId.set(value ? Number(value) : null);
        this.page.set(1);

        // l'adresse ne doit plus imposer l'ancien fournisseur au rechargement
        if (this.route.snapshot.queryParamMap.has("supplierId")) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { supplierId: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
            });
        }
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }

    onRowPick(entry: StockEntry, id: string) {
        if (id === "product") {
            this.router.navigate(["/products", entry.product_id], { state: this.backState() });
        } else {
            this.correct(entry);
        }
    }

    // message de confirmation après un ajustement du stock
    private toast = inject(ToastService);

    // erreur de saisie : la fenêtre d'ajustement s'ouvre déjà réglée pour retirer cette quantité
    correctError = signal<string | null>(null);

    correct(entry: StockEntry) {
        this.correctError.set(null);

        this.productService
            .getProduct(entry.product_id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (product) =>
                    this.adjustDialog().show(product, {
                        direction: "loss",
                        quantity: Math.min(entry.quantity, product.theoretical_stock),
                        reason: "correction",
                    }),
                error: () => this.correctError.set("Impossible d'ouvrir la correction."),
            });
    }

    onCorrected(message: string) {
        this.toast.show(message);
        this.stockAlerts.alerts.reload();
    }
}

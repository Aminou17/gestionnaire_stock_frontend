import { DatePipe, DecimalPipe, formatDate } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    LOCALE_ID,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { BackState } from "../../core/back-link";
import { AuthService } from "../../core/auth/auth.service";
import {
    MOVEMENT_TYPES,
    StockMovement,
    StockMovementPage,
    StockMovementFilter,
    adjustmentReasonLabel,
    isInventoryMovement,
    isManualMovement,
    isOutgoingMovement,
    saleId,
} from "../../core/stock/stock-movement.model";
import { StockMovementService } from "../../core/stock/stock-movement.service";
import { AdjustDialog } from "./adjust-dialog/adjust-dialog";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { MovementDetail } from "./movement-detail/movement-detail";
import { groupByDay } from "../../shared/day-label";
import { productInitials } from "../products/product-look";
import { PageHeader } from "../../layout/page-header/page-header";
import { ExportFormat } from "../../core/export-format";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Icon } from "../../shared/icon/icon";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";

const PAGE_SIZE = 20;

// petite icône de type dans le coin de la miniature (téléphone)
const TYPE_ICONS = {
    ENTRY: "arrow-down",
    SALE: "cart",
    ADJUSTMENT: "undo",
    INVENTORY_GAIN: "clipboard",
    INVENTORY_LOSS: "clipboard",
    MANUAL_GAIN: "edit",
    MANUAL_LOSS: "edit",
} as const;

type LoadedPage = StockMovementPage & { page: number };

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

@Component({
    selector: "app-stock-movements",
    imports: [
        RouterLink,
        DatePipe,
        DecimalPipe,
        PageHeader,
        PeriodFilter,
        ExportMenu,
        Icon,
        MovementDetail,
        AdjustDialog,
    ],
    templateUrl: "./stock-movements.html",
    styleUrl: "./stock-movements.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "menuOpen.set(false); filtersOpen.set(false)",
    },
})
export class StockMovements {
    private locale = inject(LOCALE_ID);
    private destroyRef = inject(DestroyRef);
    private movementService = inject(StockMovementService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    protected auth = inject(AuthService);
    private stockAlerts = inject(LowStockAlertService);

    private periodFilter = viewChild.required<PeriodFilter>("period");
    private successTimer?: ReturnType<typeof setTimeout>;
    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");
    private detailDialog = viewChild.required<MovementDetail>("detail");
    private adjustDialog = viewChild.required<AdjustDialog>("adjust");

    protected types = MOVEMENT_TYPES;
    protected isInventory = isInventoryMovement;
    protected isManual = isManualMovement;
    protected reasonLabel = adjustmentReasonLabel;
    protected saleId = saleId;
    protected initials = productInitials;
    protected typeIcons = TYPE_ICONS;

    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    type = signal<StockMovementFilter | null>(null);
    // arrivée depuis la fiche d'un produit : /stock-movements?productId=3
    productId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("productId")));
    page = signal(1);
    // mouvement dont le détail est ouvert
    selected = signal<StockMovement | null>(null);
    success = signal<string | null>(null);
    exporting = signal(false);
    exportError = signal<string | null>(null);
    // téléphone : fenêtre Filtres et menu des exports de l'en-tête
    filtersOpen = signal(false);
    menuOpen = signal(false);

    movements = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            type: this.type(),
            productId: this.productId(),
            page: this.page(),
            limit: PAGE_SIZE,
        }),
        stream: ({ params }) =>
            this.movementService
                .getMovements(params)
                .pipe(map((res) => ({ ...res, page: params.page }))),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<LoadedPage | undefined, LoadedPage | undefined>({
        source: () => (this.movements.hasValue() ? this.movements.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // mouvements déjà chargés : la page 1 remplace la liste, les suivantes s'ajoutent sans doublon
    list = linkedSignal<LoadedPage | undefined, StockMovement[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.page === 1 || !previous) return res.data;

            const known = new Set(previous.value.map((movement) => movement.id));
            return [...previous.value, ...res.data.filter((movement) => !known.has(movement.id))];
        },
    });

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);
    firstLoad = computed(() => this.movements.isLoading() && !this.last());
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.movements.isLoading() && this.page() > 1);
    filtered = computed(() => this.range().period !== "all" || this.productId() !== null);

    // le nom vient des mouvements chargés ; sans mouvement on ne le connaît pas
    productName = computed(() => {
        const id = this.productId();
        if (id === null) return null;
        return this.list().find((m) => m.product_id === id)?.product_name ?? `Produit n° ${id}`;
    });

    errorMessage = computed(() => {
        const err = this.movements.error();
        if (err instanceof HttpErrorResponse && err.error?.message) return err.error.message;
        return "Impossible de charger les mouvements.";
    });

    // la liste est triée par date : on regroupe les mouvements consécutifs du même jour
    // chaque jour porte aussi son bilan en unités : + pour ce qui entre, - pour ce qui sort
    days = computed(() =>
        groupByDay(this.list(), this.locale).map((day) => ({
            ...day,
            net: day.items.reduce(
                (sum, m) => sum + (isOutgoingMovement(m) ? -m.quantity : m.quantity),
                0,
            ),
        })),
    );

    tabs = computed(() => {
        const counters = this.counters();
        const tabs = [
            {
                label: "Tous",
                short: "Tous",
                value: null,
                count: counters?.movements,
                units: null,
                tone: "neutral",
            },
            {
                label: "Entrées",
                short: "Entrées de stock",
                value: "ENTRY",
                count: counters?.entries,
                units: counters?.entry_units,
                tone: "primary",
            },
            {
                label: "Ventes",
                short: "Ventes",
                value: "SALE",
                count: counters?.sales,
                units: counters?.sale_units,
                tone: "success",
            },
            {
                label: "Remboursements",
                short: "Retours",
                value: "ADJUSTMENT",
                count: counters?.adjustments,
                units: counters?.adjustment_units,
                tone: "danger",
            },
            {
                label: "Inventaire",
                short: "Inventaire",
                value: "INVENTORY",
                count: counters?.inventory_adjustments,
                units: counters?.inventory_units,
                tone: "warning",
            },
            {
                label: "Ajustements",
                short: "Ajustements",
                value: "MANUAL",
                count: counters?.manual_adjustments,
                units: counters?.manual_units,
                tone: "violet",
            },
        ] as const;

        // le manager ne voit que ses ventes et leurs remboursements
        if (this.auth.isAdmin()) return tabs;
        return tabs.filter((tab) => [null, "SALE", "ADJUSTMENT"].includes(tab.value));
    });

    // téléphone : les trois puces du haut, par sens du mouvement (le manager ne voit que ses sorties)
    phoneTabs = computed(() => {
        const counters = this.counters();
        const tabs = [
            { label: "Tous", value: null, count: counters?.movements },
            { label: "Entrées", value: "IN", count: counters?.incoming },
            { label: "Sorties", value: "OUT", count: counters?.outgoing },
        ] as const;

        if (this.auth.isAdmin()) return tabs;
        return tabs.filter((tab) => tab.value !== "IN");
    });

    // type choisi dans la fenêtre Filtre
    preciseType = computed(() => {
        return this.type();
    });

    // filtres de la fenêtre (et le produit), affichés en puces sous la ligne du haut
    activeFilters = computed(() => {
        const filters: { key: "period" | "type" | "product"; label: string }[] = [];
        const { period, from, to } = this.range();
        const type = this.preciseType();

        if (period !== "all")
            filters.push({ key: "period", label: this.periodLabel(period, from, to) });
        if (type) {
            filters.push({
                key: "type",
                label:
                    this.phoneTabs().find((tab) => tab.value === type)?.label ??
                    this.tabs().find((tab) => tab.value === type)?.short ??
                    "Type",
            });
        }
        if (this.productId() !== null)
            filters.push({ key: "product", label: this.productName() ?? "Produit" });

        return filters;
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            clearTimeout(this.successTimer);
        });

        // Charger la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    // après une erreur on n'ajoute pas la suite à une liste qui ne correspond plus aux filtres
                    if (
                        entry.isIntersecting &&
                        this.hasMore() &&
                        !this.movements.isLoading() &&
                        !this.movements.error()
                    ) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });
    }

    // part de ce type parmi tous les mouvements de la période, pour la barre des cartes
    share(count: number | undefined): number {
        const all = this.counters()?.movements;
        if (!count || !all) return 0;
        return Math.round((count / all) * 100);
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    allDates() {
        this.periodFilter().selectPeriod("all");
    }

    private periodLabel(period: string, from: string | null, to: string | null) {
        if (period === "today") return "Aujourd'hui";
        if (period === "week") return "7 derniers jours";
        if (period === "month") return "30 derniers jours";
        if (!from || !to) return "Période";

        const day = (date: string) => formatDate(date, "d MMM", this.locale);
        return `${day(from)} au ${day(to)}`;
    }

    clearFilter(key: "period" | "type" | "product") {
        if (key === "period") this.allDates();
        else if (key === "type") this.selectType(null);
        else this.clearProduct();
    }

    // photo agrandie au clic, sans quitter la liste
    zoom = signal<{ src: string; name: string } | null>(null);

    zoomImage(event: Event, movement: StockMovement) {
        event.stopPropagation();
        if (movement.image) this.zoom.set({ src: movement.image, name: movement.product_name });
    }

    resetFilters() {
        this.allDates();
        this.selectType(null);
    }

    toggleMenu() {
        this.menuOpen.set(!this.menuOpen());
    }

    onDocumentClick(event: Event) {
        if (!(event.target as HTMLElement).closest(".head-menu")) this.menuOpen.set(false);
    }

    selectType(value: StockMovementFilter | null) {
        this.type.set(value);
        this.page.set(1);
    }

    clearProduct() {
        this.productId.set(null);
        this.page.set(1);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { productId: null },
            queryParamsHandling: "merge",
            replaceUrl: true,
        });
    }

    // la fiche ouverte sait ainsi revenir ici, avec les mêmes filtres
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Mouvements" };
    }

    // une vente ou un inventaire ouvre directement sa page ; les autres mouvements (entrée, ajustement)
    // n'ont pas de page à eux : leur détail s'affiche dans une fenêtre, sans quitter la liste
    open(movement: StockMovement) {
        const sale = saleId(movement);

        if (sale) {
            this.router.navigate(["/sales", sale], { state: this.backState() });
            return;
        }

        if (isInventoryMovement(movement)) {
            this.router.navigate(["/inventories", movement.reference_id], {
                state: this.backState(),
            });
            return;
        }

        this.selected.set(movement);
        this.detailDialog().show();
    }

    // la barre espace ouvre la ligne, mais pas quand elle sert à un lien ou un bouton dedans
    openWithSpace(event: Event, movement: StockMovement) {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.open(movement);
    }

    // ajustement manuel du stock (admin)
    openAdjust() {
        this.success.set(null);
        this.adjustDialog().show();
    }

    onAdjusted(message: string) {
        this.success.set(message);
        // le message s'efface seul au bout de quelques secondes
        clearTimeout(this.successTimer);
        this.successTimer = setTimeout(() => this.success.set(null), 6000);
        if (this.page() === 1) {
            this.movements.reload();
        } else {
            this.page.set(1);
        }
        this.stockAlerts.alerts.reload();
    }

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(null);

        this.movementService
            .exportFile(
                {
                    from: this.range().from,
                    to: this.range().to,
                    type: this.type(),
                    productId: this.productId(),
                },
                format,
            )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `mouvements-stock.${format}`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url));
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set("Impossible d'exporter les mouvements.");
                },
            });
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }
}

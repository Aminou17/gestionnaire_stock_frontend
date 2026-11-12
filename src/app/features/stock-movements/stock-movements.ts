import { DatePipe, DecimalPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { BackState } from "../../core/back-link";
import { AuthService } from "../../core/auth/auth.service";
import {
    MOVEMENT_TYPES,
    StockMovement,
    StockMovementPage,
    StockMovementType,
} from "../../core/stock/stock-movement.model";
import { StockMovementService } from "../../core/stock/stock-movement.service";
import { MovementDetail } from "./movement-detail/movement-detail";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";

const PAGE_SIZE = 20;

type LoadedPage = StockMovementPage & { page: number };

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

@Component({
    selector: "app-stock-movements",
    imports: [RouterLink, DatePipe, DecimalPipe, PageHeader, PeriodFilter, Icon, MovementDetail],
    templateUrl: "./stock-movements.html",
    styleUrl: "./stock-movements.css",
})
export class StockMovements {
    private movementService = inject(StockMovementService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    protected auth = inject(AuthService);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    protected types = MOVEMENT_TYPES;

    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    type = signal<StockMovementType | null>(null);
    // arrivée depuis la fiche d'un produit : /stock-movements?productId=3
    productId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("productId")));
    page = signal(1);

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

    tabs = computed(() => {
        const counters = this.counters();
        return [
            {
                label: "Tous les mouvements",
                short: "Tous",
                value: null,
                count: counters?.movements,
                units: null,
                tone: "neutral",
            },
            {
                label: "Entrées",
                short: "Entrées",
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
                short: "Remboursements",
                value: "ADJUSTMENT",
                count: counters?.adjustments,
                units: counters?.adjustment_units,
                tone: "danger",
            },
        ] as const;
    });

    // unités du type choisi ; rien quand on regarde tous les types
    selectedUnits = computed(
        () => this.tabs().find((tab) => tab.value === this.type())?.units ?? null,
    );

    constructor() {
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

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectType(value: StockMovementType | null) {
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

    // détail du mouvement dans une fenêtre, sans quitter la liste
    private detailDialog = viewChild.required<MovementDetail>("detail");
    selected = signal<StockMovement | null>(null);

    open(movement: StockMovement) {
        this.selected.set(movement);
        this.detailDialog().show();
    }

    // une entrée ne mène nulle part : la page des entrées n'a pas de fiche
    saleId(movement: StockMovement) {
        return movement.type === "ENTRY" ? null : movement.reference_id;
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    exportCsv() {
        this.exporting.set(true);
        this.exportError.set(null);

        this.movementService
            .exportCsv({
                from: this.range().from,
                to: this.range().to,
                type: this.type(),
                productId: this.productId(),
            })
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "mouvements-stock.csv";
                    link.click();
                    URL.revokeObjectURL(url);
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

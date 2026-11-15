import { Icon } from "../../../shared/icon/icon";
import { Pagination, storedPageSize } from "../../../shared/pagination/pagination";
import { CashTabs } from "../cash-tabs/cash-tabs";
import {
    Component,
    computed,
    LOCALE_ID,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { formatDate } from "@angular/common";
import { rxResource } from "@angular/core/rxjs-interop";

import { CashMovementPage, CashMovementRow, CashMovementType } from "../../../core/cash/cash.model";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { CASH_REASONS } from "../../../core/cash/cash-reasons";
import { PageHeader } from "../../../layout/page-header/page-header";
import { groupByDay } from "../../../shared/day-label";
import { PeriodFilter, PeriodRange } from "../../../shared/period-filter/period-filter";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashMovementList } from "../cash-movement-list/cash-movement-list";
import { MoneyToggle } from "../../../shared/money/money-toggle";

const TYPES: { label: string; value: CashMovementType | null }[] = [
    { label: "Tous", value: null },
    { label: "Ventes", value: "SALE" },
    { label: "Ajouts", value: "DEPOSIT" },
    { label: "Dépenses", value: "EXPENSE" },
    { label: "Retraits", value: "WITHDRAWAL" },
];

// Journal de tous les mouvements de caisse (administrateur seulement, comme l'API)
@Component({
    host: { "(document:keydown.escape)": "filtersOpen.set(false)" },
    selector: "app-cash-movements",
    imports: [
        MoneyToggle,
        CashTabs,
        Icon,
        PageHeader,
        PeriodFilter,
        FcfaPipe,
        CashMovementList,
        Pagination,
    ],
    templateUrl: "./cash-movements.html",
    styleUrl: "./cash-movements.css",
})
export class CashMovements {
    private movementService = inject(CashMovementService);
    private locale = inject(LOCALE_ID);

    types = TYPES;
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    type = signal<CashMovementType | null>(null);
    category = signal<string | null>(null);
    page = signal(1);
    pageSize = storedPageSize("cash-movements");
    filtersOpen = signal(false);
    private periodFilter = viewChild.required<PeriodFilter>("period");

    // le motif ne se choisit qu'après le type, car chaque type a sa liste
    reasons = computed(() => {
        const type = this.type();
        return type && type !== "SALE" ? CASH_REASONS[type] : [];
    });

    movements = rxResource({
        params: () => ({
            type: this.type(),
            from: this.range().from,
            to: this.range().to,
            category: this.category(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) => this.movementService.getMovements(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<CashMovementPage | undefined, CashMovementPage | undefined>({
        source: () => (this.movements.hasValue() ? this.movements.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);

    // les mouvements chargés, regroupés par jour
    days = computed(() => groupByDay(this.list(), this.locale));

    total = computed(() => this.last()?.pagination.total ?? 0);
    summary = computed(() => this.last()?.summary);
    // les squelettes remplacent aussi l'ancienne liste quand on change de filtre
    firstLoad = computed(() => this.movements.isLoading() && !this.last());
    // d'après le nombre de pages : une page qui n'apporte rien de nouveau ne relance pas le chargement

    // filtres choisis dans la fenêtre, affichés en puces à côté du bouton
    activeFilters = computed(() => {
        const filters: { key: "period" | "type" | "category"; label: string }[] = [];
        const { period, from, to } = this.range();
        const type = this.type();

        if (period !== "all") {
            filters.push({ key: "period", label: this.periodLabel(period, from, to) });
        }
        if (type) {
            filters.push({
                key: "type",
                label: this.types.find((item) => item.value === type)?.label ?? "Type",
            });
        }
        const category = this.category();
        if (category) {
            filters.push({
                key: "category",
                label: this.reasons().find((reason) => reason.value === category)?.label ?? "Motif",
            });
        }
        return filters;
    });

    private periodLabel(period: string, from: string | null, to: string | null) {
        if (period === "today") return "Aujourd'hui";
        if (period === "week") return "7 derniers jours";
        if (period === "month") return "30 derniers jours";
        if (!from || !to) return "Période";

        const day = (date: string) => formatDate(date, "d MMM", this.locale);
        return `${day(from)} au ${day(to)}`;
    }

    clearFilter(key: "period" | "type" | "category") {
        if (key === "period") this.periodFilter().selectPeriod("all");
        else if (key === "type") this.selectType(null);
        else this.selectCategory("");
    }

    resetFilters() {
        this.periodFilter().selectPeriod("all");
        this.selectType(null);
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectType(value: CashMovementType | null) {
        this.type.set(value);
        this.category.set(null);
        this.page.set(1);
    }

    selectCategory(value: string) {
        this.category.set(value || null);
        this.page.set(1);
    }
}

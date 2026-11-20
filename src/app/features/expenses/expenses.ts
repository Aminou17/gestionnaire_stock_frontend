import { DatePipe, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, linkedSignal, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { CashMovementPage, CashMovementRow } from "../../core/cash/cash.model";
import { CashMovementService } from "../../core/cash/cash-movement.service";
import { EXPENSE_CATEGORIES, expenseCategory } from "../../core/cash/expense-look";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

const HISTORY_KEY = "expenses-history";

const readHistoryOpen = () => {
    try {
        return localStorage.getItem(HISTORY_KEY) === "1";
    } catch {
        return false;
    }
};

type PeriodKey = "month" | "last-month" | "week" | "all";

interface DayGroup {
    day: string;
    total: number;
    items: CashMovementRow[];
}

@Component({
    selector: "app-expenses",
    imports: [
        DatePipe,
        RouterLink,
        PageHeader,
        Icon,
        FcfaPipe,
        MoneyToggle,
        Pagination,
        EmptyState,
    ],
    templateUrl: "./expenses.html",
    styleUrl: "./expenses.css",
})
export class Expenses {
    private movements = inject(CashMovementService);
    private router = inject(Router);
    private locale = inject(LOCALE_ID);

    protected categories = EXPENSE_CATEGORIES;
    protected look = expenseCategory;

    // la fiche d'une dépense ramène ici
    protected backState = { backTo: "/expenses", backLabel: "Dépenses" };

    periods: { key: PeriodKey; label: string }[] = [
        { key: "month", label: "Ce mois-ci" },
        { key: "last-month", label: "Mois dernier" },
        { key: "week", label: "7 jours" },
        { key: "all", label: "Tout" },
    ];

    period = signal<PeriodKey>("month");
    category = signal<string | null>(null);
    page = signal(1);
    pageSize = storedPageSize("expenses");

    // bornes de la période choisie, au format YYYY-MM-DD
    range = computed(() => {
        const today = new Date();
        const day = (date: Date) => formatDate(date, "yyyy-MM-dd", this.locale);

        switch (this.period()) {
            case "month":
                return {
                    from: day(new Date(today.getFullYear(), today.getMonth(), 1)),
                    to: day(today),
                };
            case "last-month":
                return {
                    from: day(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
                    to: day(new Date(today.getFullYear(), today.getMonth(), 0)),
                };
            case "week": {
                const start = new Date(today);
                start.setDate(today.getDate() - 6);
                return { from: day(start), to: day(today) };
            }
            default:
                return { from: null, to: null };
        }
    });

    summary = rxResource({
        params: () => this.range(),
        stream: ({ params }) => this.movements.getExpenseSummary(params.from, params.to),
    });

    // l'historique se déplie à la demande ; le choix est gardé d'une visite à l'autre
    historyOpen = signal(readHistoryOpen());

    toggleHistory() {
        const open = !this.historyOpen();
        this.historyOpen.set(open);
        try {
            localStorage.setItem(HISTORY_KEY, open ? "1" : "0");
        } catch {
            // navigation privée : le choix ne sera pas gardé
        }
    }

    // la liste n'est chargée que lorsque l'historique est affiché
    expenses = rxResource({
        params: () =>
            !this.historyOpen()
                ? undefined
                : {
                      type: "EXPENSE" as const,
                      from: this.range().from,
                      to: this.range().to,
                      category: this.category(),
                      page: this.page(),
                      limit: this.pageSize(),
                  },
        stream: ({ params }) => this.movements.getMovements(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    private last = linkedSignal<CashMovementPage | undefined, CashMovementPage | undefined>({
        source: () => (this.expenses.hasValue() ? this.expenses.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);
    total = computed(() => this.last()?.pagination.total ?? 0);
    firstLoad = computed(() => this.expenses.isLoading() && !this.last());

    // répartition par motif
    breakdown = computed(() => {
        if (!this.summary.hasValue()) return [];
        const { categories } = this.summary.value();
        return categories.map((row) => ({
            ...row,
            look: expenseCategory(row.category),
        }));
    });

    // dépenses rangées par jour, comme un relevé de banque
    groups = computed<DayGroup[]>(() => {
        const groups: DayGroup[] = [];
        for (const item of this.list()) {
            const day = item.created_at.slice(0, 10);
            const group = groups.at(-1);
            if (group?.day === day) {
                group.items.push(item);
                group.total += item.amount;
            } else {
                groups.push({ day, total: item.amount, items: [item] });
            }
        }
        return groups;
    });

    dayLabel(day: string) {
        const today = formatDate(new Date(), "yyyy-MM-dd", this.locale);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (day === today) return "Aujourd'hui";
        if (day === formatDate(yesterday, "yyyy-MM-dd", this.locale)) return "Hier";
        return formatDate(day, "EEEE d MMMM", this.locale);
    }

    selectPeriod(key: PeriodKey) {
        this.period.set(key);
        this.page.set(1);
    }

    // un second clic sur le motif choisi le retire
    selectCategory(value: string | null) {
        this.category.set(this.category() === value ? null : value);
        // filtrer sur un motif montre le résultat
        if (this.category() !== null && !this.historyOpen()) this.toggleHistory();
        this.page.set(1);
    }

    openExpense(item: CashMovementRow) {
        this.router.navigate(["/expenses", item.id], { state: this.backState });
    }
}

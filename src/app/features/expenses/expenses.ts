import { DatePipe, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, linkedSignal, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { CashMovementPage, CashMovementRow } from "../../core/cash/cash.model";
import { CashMovementService } from "../../core/cash/cash-movement.service";
import { EXPENSE_CATEGORIES, expenseCategory } from "../../core/cash/expense-look";
import { ExportFormat } from "../../core/export-format";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

type PeriodKey = "month" | "last-month" | "week" | "all" | "custom";

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
        ExportMenu,
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
        { key: "month", label: "Ce mois" },
        { key: "last-month", label: "Mois dernier" },
        { key: "week", label: "7 jours" },
        { key: "all", label: "Tout" },
        { key: "custom", label: "Dates" },
    ];

    period = signal<PeriodKey>("month");
    // dates choisies à la main (YYYY-MM-DD), valables quand la période est « Dates… »
    customFrom = signal("");
    customTo = signal("");
    search = signal("");
    private searchTimer?: ReturnType<typeof setTimeout>;
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
            case "custom":
                // pas de requête tant que les deux dates ne sont pas valides
                return this.customError()
                    ? { from: null, to: null }
                    : { from: this.customFrom(), to: this.customTo() };
            default:
                return { from: null, to: null };
        }
    });

    customError = computed(() => {
        if (this.period() !== "custom") return null;
        const from = this.customFrom();
        const to = this.customTo();
        const today = formatDate(new Date(), "yyyy-MM-dd", this.locale);
        if (!from || !to) return "Choisissez une date de début et une date de fin.";
        if (from > today || to > today) return "Une date ne peut pas être dans le futur.";
        if (from > to) return "La date de début doit précéder la date de fin.";
        return null;
    });

    summary = rxResource({
        params: () => this.range(),
        stream: ({ params }) => this.movements.getExpenseSummary(params.from, params.to),
    });

    expenses = rxResource({
        params: () => ({
            type: "EXPENSE" as const,
            from: this.range().from,
            to: this.range().to,
            category: this.category(),
            search: this.search() || null,
            page: this.page(),
            limit: this.pageSize(),
        }),
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
            // une dépense annulée reste visible mais ne compte pas dans le total du jour
            const amount = item.cancelled ? 0 : item.amount;
            if (group?.day === day) {
                group.items.push(item);
                group.total += amount;
            } else {
                groups.push({ day, total: amount, items: [item] });
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
        if (key === "custom" && !this.customFrom()) {
            // on part des 7 derniers jours : il ne reste qu'à ajuster
            const today = new Date();
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            this.customFrom.set(formatDate(start, "yyyy-MM-dd", this.locale));
            this.customTo.set(formatDate(today, "yyyy-MM-dd", this.locale));
        }
        this.period.set(key);
        this.page.set(1);
    }

    setCustom(from: string, to: string) {
        this.customFrom.set(from);
        this.customTo.set(to);
        this.page.set(1);
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search.set(value.trim());
            this.page.set(1);
        }, 300);
    }

    // un second clic sur le motif choisi le retire
    selectCategory(value: string | null) {
        this.category.set(this.category() === value ? null : value);
        this.page.set(1);
    }

    // part de chaque motif dans le total, pour la barre de couleurs
    share(total: number) {
        const all = this.summary.hasValue() ? this.summary.value().total : 0;
        return all > 0 ? (total / all) * 100 : 0;
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(null);

        this.movements
            .exportExpenses(
                {
                    from: this.range().from,
                    to: this.range().to,
                    category: this.category(),
                    search: this.search() || null,
                },
                format,
            )
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `depenses.${format}`;
                    link.click();
                    URL.revokeObjectURL(url);
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set("Impossible d'exporter les dépenses.");
                },
            });
    }

    openExpense(item: CashMovementRow) {
        this.router.navigate(["/expenses", item.id], { state: this.backState });
    }
}

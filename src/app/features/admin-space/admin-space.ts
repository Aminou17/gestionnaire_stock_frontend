import { NgTemplateOutlet, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { expenseCategory } from "../../core/cash/expense-look";
import { ReportService } from "../../core/reports/report.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { Period, validateRange } from "../../shared/period-filter/period-filter";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { StatCard } from "../dashboard/stat-card/stat-card";

const PERIOD_PILLS: { value: Period; label: string }[] = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "7 jours" },
    { value: "month", label: "Ce mois" },
    { value: "custom", label: "Dates" },
];

@Component({
    selector: "app-admin-space",
    imports: [NgTemplateOutlet, PageHeader, EmptyState, Icon, MoneyToggle, StatCard, FcfaPipe],
    templateUrl: "./admin-space.html",
    styleUrl: "./admin-space.css",
})
export class AdminSpace {
    private reports = inject(ReportService);
    private locale = inject(LOCALE_ID);

    periodPills = PERIOD_PILLS;
    today = this.daysAgo(0);

    // jour du stock ; la période des ventes et des dépenses se choisit à part
    stockDate = signal(this.today);
    period = signal<Period>("today");
    customFrom = signal(this.daysAgo(6));
    customTo = signal(this.today);
    customError = signal<string | null>(null);
    categoriesOpen = signal(false);

    range = computed(() => {
        const period = this.period();

        if (period === "custom") return { from: this.customFrom(), to: this.customTo() };
        if (period === "week") return { from: this.daysAgo(6), to: this.today };
        if (period === "month") {
            return { from: formatDate(new Date(), "yyyy-MM-01", this.locale), to: this.today };
        }
        return { from: this.today, to: this.today };
    });

    // pas de requête tant que les dates choisies sont fausses
    balance = rxResource({
        params: () =>
            this.customError() ? undefined : { date: this.stockDate(), ...this.range() },
        stream: ({ params }) => this.reports.getBalance(params),
    });

    data = computed(() => (this.balance.hasValue() ? this.balance.value() : null));
    loading = computed(() => this.balance.isLoading() && !this.data());
    failed = computed(() => this.balance.error() !== undefined && !this.data());

    // une seule journée choisie : « le 21 novembre » ; sinon « du … au … »
    singleDay = computed(() => this.range().from === this.range().to);
    periodLabel = computed(() => {
        const { from, to } = this.range();
        const short = (date: string) => formatDate(date, "d MMM", this.locale);
        return from === to ? short(from) : `${short(from)} au ${short(to)}`;
    });

    netPositive = computed(() => (this.data()?.netProfit ?? 0) >= 0);

    // motifs de dépenses avec leur couleur, et leur part du total pour la barre
    expenseRows = computed(() => {
        const expenses = this.data()?.expenses;
        if (!expenses) return [];

        return expenses.categories.map((row) => ({
            ...row,
            look: expenseCategory(row.category),
            share: expenses.total > 0 ? Math.round((row.total / expenses.total) * 100) : 0,
        }));
    });

    // part du stock par catégorie (valeur de vente), pour la petite barre de chaque ligne
    stockRows = computed(() => {
        const stock = this.data()?.stock;
        if (!stock) return [];

        return stock.categories.map((row) => ({
            ...row,
            share: stock.saleValue > 0 ? Math.round((row.saleValue / stock.saleValue) * 100) : 0,
        }));
    });

    selectPeriod(period: Period) {
        this.customError.set(null);
        this.period.set(period);

        if (period === "custom") this.checkCustomRange();
    }

    applyCustomRange(from: string, to: string) {
        this.customFrom.set(from);
        this.customTo.set(to);
        this.checkCustomRange();
    }

    changeStockDate(value: string) {
        // un champ vidé ou une date future ne change rien
        if (!value || value > this.today) return;
        this.stockDate.set(value);
    }

    private checkCustomRange() {
        this.customError.set(validateRange(this.customFrom(), this.customTo(), this.today));
    }

    private daysAgo(days: number) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return formatDate(date, "yyyy-MM-dd", this.locale);
    }
}

import { NgTemplateOutlet, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { ReportService } from "../../core/reports/report.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { Period, validateRange } from "../../shared/period-filter/period-filter";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

const PERIOD_PILLS: { value: Period; label: string }[] = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "7 jours" },
    { value: "month", label: "Ce mois" },
    { value: "all", label: "Tous" },
    { value: "custom", label: "Dates" },
];

@Component({
    selector: "app-admin-space",
    imports: [NgTemplateOutlet, PageHeader, EmptyState, Icon, MoneyToggle, FcfaPipe],
    templateUrl: "./admin-space.html",
    styleUrl: "./admin-space.css",
})
export class AdminSpace {
    private reports = inject(ReportService);
    private locale = inject(LOCALE_ID);

    periodPills = PERIOD_PILLS;
    today = this.daysAgo(0);

    period = signal<Period>("today");
    customFrom = signal(this.daysAgo(6));
    customTo = signal(this.today);
    customError = signal<string | null>(null);

    range = computed(() => {
        const period = this.period();

        if (period === "custom") return { from: this.customFrom(), to: this.customTo() };
        if (period === "all") return { from: "2000-01-01", to: this.today };
        if (period === "week") return { from: this.daysAgo(6), to: this.today };
        if (period === "month") {
            return { from: formatDate(new Date(), "yyyy-MM-01", this.locale), to: this.today };
        }
        return { from: this.today, to: this.today };
    });

    // pas de requête tant que les dates choisies sont fausses
    balance = rxResource({
        params: () => (this.customError() ? undefined : { date: this.range().to, ...this.range() }),
        stream: ({ params }) => this.reports.getBalance(params),
    });

    data = computed(() => (this.balance.hasValue() ? this.balance.value() : null));
    loading = computed(() => this.balance.isLoading() && !this.data());
    failed = computed(() => this.balance.error() !== undefined && !this.data());

    periodLabel = computed(() => {
        const { from, to } = this.range();
        if (this.period() === "all") return "depuis le début";
        const short = (date: string) => formatDate(date, "d MMM", this.locale);
        return from === to ? short(from) : `${short(from)} au ${short(to)}`;
    });

    // nom de la période, écrit à côté du titre « Sur la période »
    periodName = computed(() => {
        const names = {
            today: "Aujourd'hui",
            week: "7 derniers jours",
            month: "Ce mois",
            all: "Depuis le début",
        };
        const period = this.period();

        return period === "custom" ? this.periodLabel() : names[period];
    });

    // le stock est compté à la fin de la période : actuel tant que la période va jusqu'à aujourd'hui
    stockLabel = computed(() => {
        const { to } = this.range();
        return to === this.today
            ? "Stock actuel"
            : `Stock au ${formatDate(to, "d MMM", this.locale)}`;
    });

    // ce que représente le stock affiché sous le titre du stock
    stockNote = computed(() =>
        this.range().to === this.today
            ? "Actuellement disponible en boutique"
            : "Quantités en boutique à cette date",
    );

    netPositive = computed(() => (this.data()?.netProfit ?? 0) >= 0);

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

    private checkCustomRange() {
        this.customError.set(validateRange(this.customFrom(), this.customTo(), this.today));
    }

    private daysAgo(days: number) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return formatDate(date, "yyyy-MM-dd", this.locale);
    }
}

import { DatePipe, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { DashboardService } from "./dashboard.service";
import { OpenCashDialog } from "../cash/open-cash-dialog/open-cash-dialog";
import { RecentActivity } from "./recent-activity/recent-activity";
import { RecentSales } from "./recent-sales/recent-sales";
import { SalesChart } from "./sales-chart/sales-chart";
import { ManagerCashBanner } from "./manager-cash-banner/manager-cash-banner";
import { StatCard } from "./stat-card/stat-card";
import { StockAlerts } from "./stock-alerts/stock-alerts";

@Component({
    selector: "app-dashboard",
    imports: [
        RouterLink,
        DatePipe,
        FcfaPipe,
        PageHeader,
        Icon,
        StatCard,
        SalesChart,
        StockAlerts,
        RecentSales,
        RecentActivity,
        OpenCashDialog,
        ManagerCashBanner,
    ],
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.css",
})
export class Dashboard {
    private dashboard = inject(DashboardService);
    private saleService = inject(SaleService);
    private locale = inject(LOCALE_ID);
    protected auth = inject(AuthService);
    protected stockAlerts = inject(LowStockAlertService);

    today = formatDate(new Date(), "EEEE d MMMM y", this.locale);

    summary = rxResource({ stream: () => this.dashboard.getSummary() });
    dailySales = rxResource({ stream: () => this.dashboard.getDailySales() });
    comparison = rxResource({ stream: () => this.dashboard.getSalesComparison() });
    activity = rxResource({ stream: () => this.dashboard.getRecentActivity(5) });
    sales = rxResource({ stream: () => this.saleService.getSales(5) });

    // value() lève une exception quand la ressource est en erreur : on passe par hasValue()
    summaryData = computed(() => (this.summary.hasValue() ? this.summary.value() : undefined));
    salesList = computed(() => (this.sales.hasValue() ? this.sales.value() : []));
    activityList = computed(() => (this.activity.hasValue() ? this.activity.value() : []));

    // le tableau de bord du gérant n'a pas de bloc d'alertes : seule la vue admin les lit
    alertList = computed(() =>
        this.stockAlerts.alerts.hasValue() ? this.stockAlerts.alerts.value() : [],
    );

    // nombre de ruptures et de stocks faibles
    alertCounts = computed(() => {
        const alerts = this.alertList();
        const out = alerts.filter((a) => a.theoretical_stock <= 0).length;
        return { out, low: alerts.length - out, total: alerts.length };
    });

    // même découpage que la page Produits : le chiffre compte les ruptures ET le stock faible
    alertHint = computed(() => {
        const counts = this.alertCounts();
        if (counts.total === 0) return "Au seuil minimum ou en dessous";

        const parts = [];
        if (counts.out > 0) parts.push(`${counts.out} en rupture`);
        if (counts.low > 0) parts.push(`${counts.low} en stock faible`);
        return parts.join(" · ");
    });

    // le backend renvoie 30 jours, le dernier étant aujourd'hui
    lastWeek = computed(() =>
        this.dailySales.hasValue() ? this.dailySales.value().slice(-7) : [],
    );
    todaySales = computed(() => this.lastWeek().at(-1));

    cash = computed(() => this.summaryData()?.cash ?? null);
    cashOpen = computed(() => this.cash()?.status === "OPEN");
    // on ne propose d'ouvrir la caisse que si on SAIT qu'elle est fermée
    canOpenCash = computed(() => this.auth.isAdmin() && this.summary.hasValue() && !this.cash());

    // on compare à hier jusqu'à la même heure : une journée en cours contre une journée complète serait toujours en baisse
    salesHint = computed(() => {
        const comparison = this.comparison.hasValue() ? this.comparison.value() : undefined;
        if (!comparison) return { text: undefined, tone: "muted" as const };

        const today = comparison.todayTotal;
        const yesterday = comparison.yesterdayUntilNowTotal;
        if (yesterday <= 0)
            return { text: "Pas de vente à la même heure hier", tone: "muted" as const };

        const change = Math.round(((today - yesterday) / yesterday) * 100);
        const sign = change > 0 ? "+" : change < 0 ? "−" : "";
        return {
            text: `${sign}${Math.abs(change)} % vs hier à cette heure`,
            tone: change >= 0 ? ("success" as const) : ("danger" as const),
        };
    });

    cashHint = computed(() => {
        const cash = this.cash();
        if (!cash) return "Aucune session aujourd'hui";
        if (cash.status === "OPEN")
            return `Session ouverte à ${formatDate(cash.openedAt, "HH:mm", this.locale)}`;
        return `Clôturée à ${formatDate(cash.closedAt!, "HH:mm", this.locale)}`;
    });

    reloadSummary() {
        this.summary.reload();
        this.dailySales.reload();
        this.comparison.reload();
    }

    onCashOpened() {
        this.summary.reload();
        this.activity.reload();
    }
}

import { DatePipe, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { EMPTY } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { RevealToggle } from "../../shared/secret/reveal-toggle";
import { SecretValues } from "../../shared/secret/secret-values";
import type { IconName } from "../../shared/icon/icons";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { DashboardService } from "./dashboard.service";
import { OpenCashDialog } from "../cash/open-cash-dialog/open-cash-dialog";
import { ReopenCashDialog } from "../cash/reopen-cash-dialog/reopen-cash-dialog";
import { RecentActivity } from "./recent-activity/recent-activity";
import { RecentSales } from "./recent-sales/recent-sales";
import { SalesChart } from "./sales-chart/sales-chart";
import { ManagerCashBanner } from "./manager-cash-banner/manager-cash-banner";
import { StatCard } from "./stat-card/stat-card";
import { StockAlerts } from "./stock-alerts/stock-alerts";

@Component({
    selector: "app-dashboard",
    imports: [
        RevealToggle,
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
        ReopenCashDialog,
        ManagerCashBanner,
        EmptyState,
    ],
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.css",
})
export class Dashboard {
    protected secret = inject(SecretValues);
    private dashboard = inject(DashboardService);
    private saleService = inject(SaleService);
    private locale = inject(LOCALE_ID);
    private route = inject(ActivatedRoute);
    protected auth = inject(AuthService);
    protected stockAlerts = inject(LowStockAlertService);

    // le guard admin renvoie ici l'employé qui ouvre une page réservée
    reserved = this.route.snapshot.queryParamMap.has("reserved");

    today = formatDate(new Date(), "EEEE d MMMM y", this.locale);

    summary = rxResource({ stream: () => this.dashboard.getSummary() });
    dailySales = rxResource({ stream: () => this.dashboard.getDailySales() });
    comparison = rxResource({ stream: () => this.dashboard.getSalesComparison() });
    activity = rxResource({ stream: () => this.dashboard.getRecentActivity(5) });
    sales = rxResource({ stream: () => this.saleService.getSales(5) });
    // une page d'une vente suffit : on ne lit que les compteurs (reste à encaisser)
    salesPage = rxResource({
        stream: () =>
            this.auth.isAdmin()
                ? this.saleService.getSalesPage({
                      status: null,
                      from: null,
                      to: null,
                      page: 1,
                      limit: 1,
                  })
                : EMPTY,
    });

    // value() lève une exception quand la ressource est en erreur : on passe par hasValue()
    summaryData = computed(() => (this.summary.hasValue() ? this.summary.value() : undefined));
    salesList = computed(() => (this.sales.hasValue() ? this.sales.value() : []));
    activityList = computed(() => (this.activity.hasValue() ? this.activity.value() : []));

    // le tableau de bord de l'employé n'a pas de bloc d'alertes : seule la vue admin les lit
    alertList = computed(() =>
        this.stockAlerts.alerts.hasValue() ? this.stockAlerts.alerts.value() : [],
    );

    // une boutique neuve n'a pas encore fixé son seuil : le backend répond 409, ce n'est pas une panne
    alertsNotConfigured = computed(() => {
        const error = this.stockAlerts.alerts.error() as { status?: number; cause?: { status?: number } };
        return (error?.status ?? error?.cause?.status) === 409;
    });

    // nombre de ruptures et de stocks faibles
    alertCounts = computed(() => {
        const alerts = this.alertList();
        const out = alerts.filter((a) => a.status === "OUT_OF_STOCK").length;
        return { out, low: alerts.length - out, total: alerts.length };
    });

    // ce que les clients doivent encore : acomptes pas soldés
    dueTotal = computed(() =>
        this.salesPage.hasValue() ? (this.salesPage.value().counters?.due_total ?? 0) : 0,
    );
    dueHint = computed(() => {
        const count = this.salesPage.hasValue()
            ? (this.salesPage.value().counters?.unpaid ?? 0)
            : 0;
        if (count === 0) return "Tout est encaissé";
        return `${count} vente${count > 1 ? "s" : ""} non réglée${count > 1 ? "s" : ""}`;
    });

    profitHint = computed(() => {
        const margin = this.summaryData()?.todayMargin;
        return margin == null ? "Pas encore de vente" : `Marge de ${margin} %`;
    });
    profitTone = computed(() => {
        const profit = this.summaryData()?.todayProfit ?? 0;
        return profit > 0 ? ("success" as const) : profit < 0 ? ("danger" as const) : undefined;
    });
    profitMissing = computed(
        () => this.summary.hasValue() && this.summaryData()?.todayProfit == null,
    );

    // le backend renvoie 30 jours, le dernier étant aujourd'hui
    lastWeek = computed(() =>
        this.dailySales.hasValue() ? this.dailySales.value().slice(-7) : [],
    );
    todaySales = computed(() => this.lastWeek().at(-1));
    weekTrend = computed(() => this.lastWeek().map((d) => d.netTotal));
    weekEmpty = computed(
        () => this.dailySales.hasValue() && this.lastWeek().every((d) => d.netTotal === 0),
    );

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
        // rien à comparer : les grands logiciels n'affichent pas de variation, on montre le nombre de ventes
        // aucune vente encore aujourd'hui : "moins 100 %" serait trompeur tôt le matin
        if (yesterday <= 0 || today <= 0) {
            const count = this.todaySales()?.salesCount ?? 0;
            const text =
                count === 0
                    ? "Aucune vente"
                    : `${count} vente${count > 1 ? "s" : ""} aujourd'hui`;
            return { text, tone: "muted" as const };
        }

        const change = Math.round(((today - yesterday) / yesterday) * 100);
        const sign = change > 0 ? "+" : change < 0 ? "−" : "";
        return {
            text: `${sign}${Math.abs(change)} % vs hier`,
            tone: change >= 0 ? ("success" as const) : ("warning" as const),
        };
    });

    cashHint = computed(() => {
        const cash = this.cash();
        if (!cash) return "";
        if (cash.status === "OPEN")
            return `Ouverte depuis ${formatDate(cash.openedAt, "HH:mm", this.locale)}`;
        return `Clôturée à ${formatDate(cash.closedAt!, "HH:mm", this.locale)}`;
    });

    // ce que l'administrateur doit faire maintenant : les alertes de stock ont déjà leur carte et leur liste
    todo = computed(() => {
        if (!this.summary.hasValue() || this.firstSteps()) return [];
        const items: { icon: IconName; text: string; label: string; reopenId?: number }[] = [];
        if (this.canOpenCash())
            items.push({
                icon: "banknote",
                text: "La caisse n'est pas ouverte. Ouvrez-la pour vendre.",
                label: "Ouvrir la caisse",
            });
        const cash = this.cash();
        if (this.auth.isAdmin() && cash?.status === "CLOSED")
            items.push({
                icon: "banknote",
                text: "La caisse est clôturée. Rouvrez-la pour continuer à vendre.",
                label: "Rouvrir la caisse",
                reopenId: cash.id,
            });
        return items;
    });

    // aucune vente enregistrée : on guide l'administrateur pas à pas, comme Shopify ou Square
    firstSteps = computed(() => {
        if (!this.summary.hasValue() || !this.sales.hasValue() || this.salesList().length > 0)
            return null;
        const steps = [
            {
                icon: "package" as IconName,
                label: "Ajouter vos produits",
                done: (this.summaryData()?.activeProducts ?? 0) > 0,
                link: "/products",
            },
            {
                icon: "banknote" as IconName,
                label: "Ouvrir la caisse",
                done: !!this.cash(),
                link: undefined,
            },
            {
                icon: "cart" as IconName,
                label: "Enregistrer une première vente",
                done: false,
                link: "/sales/new",
            },
        ];
        return { steps, doneCount: steps.filter((step) => step.done).length };
    });

    reloadSummary() {
        this.summary.reload();
        this.dailySales.reload();
        this.comparison.reload();
        this.salesPage.reload();
    }

    onCashOpened() {
        this.summary.reload();
        this.activity.reload();
    }
}

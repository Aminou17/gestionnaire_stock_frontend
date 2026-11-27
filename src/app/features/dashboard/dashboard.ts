import { DOCUMENT, formatDate } from "@angular/common";
import { Component, DestroyRef, LOCALE_ID, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { EMPTY } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { RevealToggle } from "../../shared/secret/reveal-toggle";
import { SecretValues } from "../../shared/secret/secret-values";
import type { IconName } from "../../shared/icon/icons";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { DashboardService } from "./dashboard.service";
import { ThemeService } from "../../core/theme/theme.service";
import { CountCashDialog } from "../cash/count-cash-dialog/count-cash-dialog";
import { UncountedCashNotice } from "../cash/uncounted-cash-notice/uncounted-cash-notice";
import { RecentActivity } from "./recent-activity/recent-activity";
import { RecentSales } from "./recent-sales/recent-sales";
import { SalesChart } from "./sales-chart/sales-chart";
import { ManagerCashBanner } from "./manager-cash-banner/manager-cash-banner";
import { StatCard } from "./stat-card/stat-card";
import { StockAlerts } from "./stock-alerts/stock-alerts";

const REFRESH_EVERY = 30_000;

@Component({
    selector: "app-dashboard",
    imports: [
        MoneyToggle,
        RevealToggle,
        RouterLink,
        FcfaPipe,
        PageHeader,
        Icon,
        StatCard,
        SalesChart,
        StockAlerts,
        RecentSales,
        RecentActivity,
        CountCashDialog,
        UncountedCashNotice,
        ManagerCashBanner,
        EmptyState,
    ],
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.css",
})
export class Dashboard {
    protected theme = inject(ThemeService);

    protected secret = inject(SecretValues);
    private dashboard = inject(DashboardService);
    private saleService = inject(SaleService);
    private locale = inject(LOCALE_ID);
    private fcfa = new FcfaPipe();
    private route = inject(ActivatedRoute);
    protected auth = inject(AuthService);
    protected stockAlerts = inject(LowStockAlertService);

    private document = inject(DOCUMENT);

    constructor() {
        // L'accueil suit la boutique tout seul : toutes les 30 secondes, et dès qu'on revient dessus
        const timer = setInterval(() => this.refresh(), REFRESH_EVERY);
        const onVisible = () => this.refresh();
        this.document.addEventListener("visibilitychange", onVisible);

        inject(DestroyRef).onDestroy(() => {
            clearInterval(timer);
            this.document.removeEventListener("visibilitychange", onVisible);
        });
    }

    // Rien quand la page est cachée ou sans réseau : les chiffres affichés restent à l'écran
    private refresh() {
        if (this.document.visibilityState !== "visible" || !navigator.onLine) return;

        this.reloadSummary();
        this.sales.reload();
        this.activity.reload();
        if (this.auth.isAdmin()) this.stockAlerts.alerts.reload();
    }

    // Le guard admin renvoie ici l'employé qui ouvre une page réservée
    reserved = this.route.snapshot.queryParamMap.has("reserved");

    today = formatDate(new Date(), "EEEE d MMMM y", this.locale);

    // L'admin voit toute la boutique, le gérant seulement ses ventes
    showShop = computed(() => this.auth.isAdmin());

    summary = rxResource({ stream: () => this.dashboard.getSummary() });
    dailySales = rxResource({ stream: () => this.dashboard.getDailySales(!this.auth.isAdmin()) });
    activity = rxResource({ stream: () => this.dashboard.getRecentActivity(5) });
    sales = rxResource({ stream: () => this.saleService.getSales(5) });
    // Une page d'une vente suffit : on ne lit que les compteurs (reste à encaisser)
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

    // Le tableau de bord de l'employé n'a pas de bloc d'alertes : seule la vue admin les lit
    alertList = computed(() =>
        this.stockAlerts.alerts.hasValue() ? this.stockAlerts.alerts.value() : [],
    );

    // Une boutique neuve n'a pas encore fixé son seuil : le backend répond 409, ce n'est pas une panne
    alertsNotConfigured = computed(() => {
        const error = this.stockAlerts.alerts.error() as {
            status?: number;
            cause?: { status?: number };
        };
        return (error?.status ?? error?.cause?.status) === 409;
    });

    // Nombre de ruptures et de stocks faibles
    alertCounts = computed(() => {
        const alerts = this.alertList();
        const out = alerts.filter((a) => a.status === "OUT_OF_STOCK").length;
        return { out, low: alerts.length - out, total: alerts.length };
    });

    // Ce que les clients doivent encore : acomptes pas soldés
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

    profitTone = computed(() => {
        const profit = this.summaryData()?.todayProfit ?? 0;
        return profit > 0 ? ("success" as const) : profit < 0 ? ("danger" as const) : undefined;
    });
    profitMissing = computed(
        () => this.summary.hasValue() && this.summaryData()?.todayProfit == null,
    );

    // Le backend renvoie 30 jours, le dernier étant aujourd'hui
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

    // Sous le montant de la carte "En caisse"
    cashHint = computed(() => {
        const cash = this.cash();
        if (!cash) return "Pas encore de vente";
        return cash.status === "OPEN"
            ? `Depuis ${formatDate(cash.openedAt, "HH:mm", this.locale)}`
            : "Caisse comptée";
    });
    // Caisse d'un jour passé jamais comptée : un rappel, rien n'est bloqué
    uncounted = computed(() => this.summaryData()?.uncountedSession ?? null);
    expectedOpening = computed(() => this.summaryData()?.expectedOpening ?? null);

    salesHint = computed(() => {
        const count = this.todaySales()?.salesCount ?? 0;
        const text = count === 0 ? "Aucune vente" : `${count} vente${count > 1 ? "s" : ""}`;
        return { text, tone: "muted" as const };
    });

    // Aucune vente enregistrée : on guide l'administrateur pas à pas, comme Shopify ou Square
    firstSteps = computed(() => {
        // salesPage ne se charge que pour l'admin : toutes les ventes de la boutique, pas seulement les miennes
        if (!this.summary.hasValue() || !this.salesPage.hasValue()) return null;
        if (this.salesPage.value().data.length > 0) return null;
        const steps = [
            {
                icon: "package" as IconName,
                label: "Ajouter vos produits",
                done: (this.summaryData()?.activeProducts ?? 0) > 0,
                link: "/products",
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
        this.salesPage.reload();
    }

    onCashCounted() {
        this.summary.reload();
        this.activity.reload();
    }
}

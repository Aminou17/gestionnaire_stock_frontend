import { formatDate } from "@angular/common";
import { Component, computed, LOCALE_ID, inject, linkedSignal, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { of } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { PaymentMethod, Sale, SalePage, SaleStatus } from "../../core/sales/sale.model";
import { SaleService } from "../../core/sales/sale.service";
import { ExportService } from "../settings/settings-export/export.service";
import { UserService } from "../users/user.service";
import { groupByDay } from "../../shared/day-label";
import { PageHeader } from "../../layout/page-header/page-header";
import { Period, PeriodRange, validateRange } from "../../shared/period-filter/period-filter";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { ExportFormat } from "../../core/export-format";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { MoneyToggle } from "../../shared/money/money-toggle";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";

// choix de période de la fenêtre Filtre
const PERIOD_CHOICES: { value: Period; label: string }[] = [
    { value: "all", label: "Toutes" },
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "7 jours" },
    { value: "month", label: "Ce mois" },
    { value: "custom", label: "Personnalisée" },
];

// pastilles sous le titre : « Personnalisée » devient « Dates »
const PERIOD_PILLS: { value: Period; label: string }[] = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "7 jours" },
    { value: "month", label: "Ce mois" },
    { value: "all", label: "Tout" },
    { value: "custom", label: "Dates" },
];

@Component({
    selector: "app-sales",
    imports: [
        MoneyToggle,
        RouterLink,
        PageHeader,
        ExportMenu,
        Icon,
        FcfaPipe,
        EmptyState,
        Pagination,
    ],
    templateUrl: "./sales.html",
    styleUrl: "./sales.css",
    host: { "(document:keydown.escape)": "filtersOpen.set(false)" },
})
export class Sales {
    private locale = inject(LOCALE_ID);
    private saleService = inject(SaleService);
    private router = inject(Router);
    private userService = inject(UserService);
    private exportService = inject(ExportService);
    protected auth = inject(AuthService);

    // période choisie dans le filtre (aujourd'hui au départ : c'est ce que le vendeur regarde)
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    status = signal<SaleStatus | null>(null);
    page = signal(1);
    pageSize = storedPageSize("sales");
    search = signal("");
    unpaid = signal(false);
    paymentMethod = signal<PaymentMethod | null>(null);
    sellerId = signal<number | null>(null);

    // seul l'admin choisit un vendeur, le manager ne voit que ses ventes
    users = rxResource({
        stream: () => (this.auth.isAdmin() ? this.userService.getUsers("all") : of([])),
    });
    sellers = computed(() => (this.users.hasValue() ? this.users.value() : []));

    sales = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            status: this.status(),
            unpaid: this.unpaid(),
            paymentMethod: this.paymentMethod(),
            sellerId: this.sellerId(),
            search: this.search(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) => this.saleService.getSalesPage(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<SalePage | undefined, SalePage | undefined>({
        source: () => (this.sales.hasValue() ? this.sales.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);
    firstLoad = computed(() => this.sales.isLoading() && !this.last());

    // les ventes chargées, regroupées par jour (la liste est déjà triée par date)
    days = computed(() => groupByDay(this.list(), this.locale));

    tabs = computed(() => {
        const counters = this.counters();
        return [
            {
                label: "Toutes les ventes",
                short: "Toutes",
                value: null,
                count: counters?.all,
                tone: "primary",
                icon: "receipt",
            },
            {
                label: "À solder",
                short: "À solder",
                value: "UNPAID",
                count: counters?.unpaid,
                tone: "warning",
                icon: "wallet",
            },
            {
                label: "Remboursées",
                short: "Remboursées",
                value: "CANCELLED",
                count: counters?.cancelled,
                tone: "danger",
                icon: "undo",
            },
        ] as const;
    });

    isSelected(value: SaleStatus | "UNPAID" | null) {
        return value === "UNPAID" ? this.unpaid() : !this.unpaid() && this.status() === value;
    }

    // la recherche part 300 ms après la dernière frappe
    private searchTimer?: ReturnType<typeof setTimeout>;

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search.set(value);
            this.page.set(1);
        }, 300);
    }

    selectPayment(value: PaymentMethod | null) {
        this.paymentMethod.set(value);
        this.page.set(1);
    }

    selectSeller(value: number | null) {
        this.sellerId.set(value);
        this.page.set(1);
    }

    // fenêtre Filtre : fenêtre du bas sur téléphone, petit panneau sur ordinateur
    filtersOpen = signal(false);
    periodChoices = PERIOD_CHOICES;
    periodPills = PERIOD_PILLS;
    customFrom = signal("");
    customTo = signal("");
    customError = signal<string | null>(null);

    // carte du haut : elle suit la puce choisie (toutes, à solder, remboursées)
    summary = computed(() => {
        const counters = this.counters();
        const plural = (n: number | undefined, word: string) =>
            `${n ?? 0} ${word}${(n ?? 0) > 1 ? "s" : ""}`;

        if (this.status() === "CANCELLED") {
            return {
                label: "Remboursé",
                amount: counters?.cancelled_total,
                tone: "danger",
                icon: "undo" as const,
                note: plural(counters?.cancelled, "remboursement"),
            };
        }
        if (this.unpaid()) {
            return {
                label: "Reste à encaisser",
                amount: counters?.due_total,
                tone: "warning",
                icon: "wallet" as const,
                note: plural(counters?.unpaid, "vente"),
            };
        }
        return {
            label: "Encaissé",
            amount: counters?.active_total,
            tone: "success",
            icon: "banknote" as const,
            note: plural(counters?.active, "vente"),
        };
    });

    selectPeriod(period: Period) {
        this.customError.set(null);

        if (period === "custom") {
            // on part des 7 derniers jours : il ne reste qu'à ajuster
            if (!this.customFrom()) {
                this.customFrom.set(this.daysAgo(6));
                this.customTo.set(this.daysAgo(0));
            }
            this.setRange("custom", this.customFrom(), this.customTo());
            return;
        }

        const from =
            period === "today"
                ? this.daysAgo(0)
                : period === "week"
                  ? this.daysAgo(6)
                  : period === "month"
                    ? formatDate(new Date(), "yyyy-MM-01", this.locale)
                    : null;
        this.setRange(period, from, from ? this.daysAgo(0) : null);
    }

    applyCustomRange(from: string, to: string) {
        this.customFrom.set(from);
        this.customTo.set(to);

        const error = validateRange(from, to, this.daysAgo(0));
        this.customError.set(error);
        if (!error) this.setRange("custom", from, to);
    }

    private setRange(period: Period, from: string | null, to: string | null) {
        this.range.set({ period, from, to });
        this.page.set(1);
    }

    private daysAgo(days: number) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return formatDate(date, "yyyy-MM-dd", this.locale);
    }

    private customLabel(from: string | null, to: string | null) {
        if (!from || !to) return "Dates choisies";
        const short = (date: string) => formatDate(date, "d MMM", this.locale);
        return from === to ? short(from) : `${short(from)} au ${short(to)}`;
    }

    resetFilters() {
        this.customFrom.set("");
        this.customTo.set("");
        this.selectPeriod("all");
        this.selectPayment(null);
        this.selectSeller(null);
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    // l'export existant prend la période choisie, pas les autres filtres
    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(null);

        this.exportService.salesFile(this.range().from, this.range().to, format).subscribe({
            next: (file) => {
                this.exporting.set(false);
                const url = URL.createObjectURL(file);
                const link = document.createElement("a");
                link.href = url;
                link.download = `ventes.${format}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url));
            },
            error: (err) => {
                this.exporting.set(false);
                this.exportError.set(
                    err.status === 413
                        ? "Il y a trop de ventes pour un seul fichier, réduisez la période."
                        : "Impossible d'exporter les ventes.",
                );
            },
        });
    }

    selectStatus(value: SaleStatus | "UNPAID" | null) {
        this.unpaid.set(value === "UNPAID");
        this.status.set(value === "UNPAID" ? null : value);
        this.page.set(1);
    }

    // filtre demandé par le lien qui a ouvert la page (cartes du tableau de bord)
    constructor() {
        const params = inject(ActivatedRoute).snapshot.queryParamMap;
        const period = params.get("period");
        const unpaid = params.get("filter") === "unpaid";

        // les ventes à solder viennent de toutes les dates : on ne les limite pas à aujourd'hui
        if (unpaid) this.selectStatus("UNPAID");
        else if (period === "week" || period === "month") this.selectPeriod(period);
        else this.selectPeriod("today");
        if (unpaid && (period === "today" || period === "week" || period === "month")) {
            this.selectPeriod(period);
        }
    }

    openSale(sale: Sale) {
        this.router.navigate(["/sales", sale.id]);
    }

    // reste à payer sur une vente validée avec acompte
    due(sale: Sale) {
        return sale.status === "ACTIVE" ? sale.total - sale.paid_amount : 0;
    }

    iconName(sale: Sale) {
        if (sale.status === "CANCELLED") return "undo";
        return sale.payment_method === "MOBILE_MONEY" ? "phone" : "banknote";
    }

    tone(sale: Sale) {
        if (sale.status === "CANCELLED") return "danger";
        return this.due(sale) > 0 ? "warning" : "success";
    }

    // une liste reste légère : l'heure et le client, le détail est sur la fiche de la vente
    subtitle(sale: Sale) {
        const time = formatDate(sale.created_at, "HH:mm", this.locale);
        return sale.customer_name ? `${time} · ${sale.customer_name}` : time;
    }

    emptyTitle() {
        const period = this.range().period;
        if (period === "today") return "Aucune vente aujourd'hui";
        return period === "all" ? "Aucune vente pour le moment" : "Aucune vente sur cette période";
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }
}

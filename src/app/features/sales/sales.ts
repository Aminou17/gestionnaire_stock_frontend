import { DatePipe } from "@angular/common";
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
import { Router, RouterLink } from "@angular/router";
import { map, of } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { getRoleLabel } from "../../core/auth/role-label";
import { PaymentMethod, Sale, SalePage, SaleStatus } from "../../core/sales/sale.model";
import { SaleService } from "../../core/sales/sale.service";
import { ExportService } from "../settings/settings-export/export.service";
import { UserService } from "../users/user.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

const PAGE_SIZE = 20;

type LoadedPage = SalePage & { page: number };

@Component({
    selector: "app-sales",
    imports: [RouterLink, DatePipe, PageHeader, PeriodFilter, Icon, FcfaPipe],
    templateUrl: "./sales.html",
    styleUrl: "./sales.css",
})
export class Sales {
    private saleService = inject(SaleService);
    private router = inject(Router);
    private userService = inject(UserService);
    private exportService = inject(ExportService);
    protected auth = inject(AuthService);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    // période choisie dans <app-period-filter> (toutes les dates au départ)
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    status = signal<SaleStatus | null>(null);
    page = signal(1);
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
            limit: PAGE_SIZE,
        }),
        // on garde le numéro de page pour savoir s'il faut remplacer ou ajouter
        stream: ({ params }) =>
            this.saleService
                .getSalesPage(params)
                .pipe(map((res) => ({ ...res, page: params.page }))),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<LoadedPage | undefined, LoadedPage | undefined>({
        source: () => (this.sales.hasValue() ? this.sales.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // ventes déjà chargées : la page 1 remplace la liste, les suivantes s'ajoutent au bout
    list = linkedSignal<LoadedPage | undefined, Sale[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.page === 1 || !previous) return res.data;

            // une vente créée pendant le défilement décale les pages : on évite les doublons
            const known = new Set(previous.value.map((sale) => sale.id));
            return [...previous.value, ...res.data.filter((sale) => !known.has(sale.id))];
        },
    });

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);
    firstLoad = computed(() => this.sales.isLoading() && !this.last());
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.sales.isLoading() && this.page() > 1);

    tabs = computed(() => {
        const counters = this.counters();
        return [
            {
                label: "Toutes les ventes",
                short: "Toutes",
                value: null,
                count: counters?.all,
                tone: "primary",
            },
            {
                label: "À solder",
                short: "À solder",
                value: "UNPAID",
                count: counters?.unpaid,
                tone: "warning",
            },
            {
                label: "Remboursées",
                short: "Remboursées",
                value: "CANCELLED",
                count: counters?.cancelled,
                tone: "danger",
            },
        ] as const;
    });

    constructor() {
        // Charger la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && this.hasMore() && !this.sales.isLoading()) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });
    }

    isSelected(value: SaleStatus | "UNPAID" | null) {
        return value === "UNPAID" ? this.unpaid() : !this.unpaid() && this.status() === value;
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
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

    selectPayment(value: string) {
        this.paymentMethod.set(value === "CASH" || value === "MOBILE_MONEY" ? value : null);
        this.page.set(1);
    }

    selectSeller(value: string) {
        this.sellerId.set(Number(value) || null);
        this.page.set(1);
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    // l'export existant prend la période choisie, pas les autres filtres
    exportCsv() {
        this.exporting.set(true);
        this.exportError.set(null);

        this.exportService.salesCsv(this.range().from, this.range().to).subscribe({
            next: (file) => {
                this.exporting.set(false);
                const url = URL.createObjectURL(file);
                const link = document.createElement("a");
                link.href = url;
                link.download = "ventes.csv";
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

    paymentLabel(method: Sale["payment_method"]) {
        return method === "MOBILE_MONEY" ? "Mobile money" : method === "CASH" ? "Espèces" : "";
    }

    selectStatus(value: SaleStatus | "UNPAID" | null) {
        this.unpaid.set(value === "UNPAID");
        this.status.set(value === "UNPAID" ? null : value);
        this.page.set(1);
    }

    openSale(sale: Sale) {
        this.router.navigate(["/sales", sale.id]);
    }

    // reste à payer sur une vente validée avec acompte
    due(sale: Sale) {
        return sale.status === "ACTIVE" ? sale.total - sale.paid_amount : 0;
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }

    // Libellé du rôle du vendeur (rien si le backend ne l'a pas envoyé)
    roleLabel(role: Sale["user_role"]) {
        return getRoleLabel(role);
    }
}

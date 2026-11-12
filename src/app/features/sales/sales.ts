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
import { map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { getRoleLabel } from "../../core/auth/role-label";
import { Sale, SalePage, SaleStatus } from "../../core/sales/sale.model";
import { SaleService } from "../../core/sales/sale.service";
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
    protected auth = inject(AuthService);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    // période choisie dans <app-period-filter> (toutes les dates au départ)
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    status = signal<SaleStatus | null>(null);
    page = signal(1);

    sales = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            status: this.status(),
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

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectStatus(value: SaleStatus | null) {
        this.status.set(value);
        this.page.set(1);
    }

    openSale(sale: Sale) {
        this.router.navigate(["/sales", sale.id]);
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }

    // Libellé du rôle du vendeur (rien si le backend ne l'a pas envoyé)
    roleLabel(role: Sale["user_role"]) {
        return getRoleLabel(role);
    }
}

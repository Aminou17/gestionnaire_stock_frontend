import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    computed,
    inject,
    linkedSignal,
    signal,
    ElementRef,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DatePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { Icon } from "../../../../shared/icon/icon";
import { Pagination, storedPageSize } from "../../../../shared/pagination/pagination";
import { PeriodFilter, PeriodRange } from "../../../../shared/period-filter/period-filter";
import { OwnerShopService } from "../../owner-shop.service";
import { NO_FILTERS, Page, SecurityEvent, SecurityFilters } from "../security.model";
import { SecurityService } from "../security.service";
import { SecurityRow, SecurityTable } from "../security-table/security-table";
import { EVENT_LABELS, LIST_CONFIGS, ListKind } from "./security-list.config";

// Une seule page pour les trois listes (connexions, comptes bloqués, accès et mots de passe) :
// la route indique laquelle avec data.kind, et security-list.config.ts décrit ses colonnes.
@Component({
    selector: "app-security-list",
    imports: [DatePipe, RouterLink, Icon, Pagination, PeriodFilter, SecurityTable],
    templateUrl: "./security-list.html",
    styleUrls: ["../../../../shared/dialog/dialog.css", "./security-list.css"],
    host: { "(document:keydown.escape)": "filtersOpen.set(false)" },
})
export class SecurityList {
    private security = inject(SecurityService);
    private shopService = inject(OwnerShopService);
    private destroyRef = inject(DestroyRef);
    private periodFilter = viewChild(PeriodFilter);
    private detailDialog = viewChild.required<ElementRef<HTMLDialogElement>>("detailDialog");
    // une minuterie par champ : taper dans l'un ne doit pas annuler la recherche de l'autre
    private emailTimer: ReturnType<typeof setTimeout> | undefined;
    private ipTimer: ReturnType<typeof setTimeout> | undefined;

    private kind = inject(ActivatedRoute).snapshot.data["kind"] as ListKind;
    protected config = LIST_CONFIGS[this.kind];

    view = signal(this.config.views?.[0].value ?? "");
    filters = signal<SecurityFilters>(NO_FILTERS);
    page = signal(1);
    pageSize = storedPageSize("security");
    filtersOpen = signal(false);
    exporting = signal(false);
    exportError = signal<string | null>(null);

    shops = rxResource({ stream: () => this.shopService.getShops() });

    list = rxResource({
        params: () => ({
            view: this.view(),
            filters: this.filters(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) =>
            this.security.getList<unknown>(this.config.path, this.query(params)),
    });

    // dernier total connu : la pagination ne disparaît pas pendant le chargement de la page suivante
    total = linkedSignal<Page<unknown> | undefined, number>({
        source: () => (this.list.hasValue() ? this.list.value() : undefined),
        computation: (page, previous) => page?.pagination.total ?? previous?.value ?? 0,
    });

    rows = computed(() =>
        this.list.hasValue() ? this.config.toRows(this.view(), this.list.value().data) : [],
    );

    // seules les lignes du journal (accès refusés, mots de passe) ouvrent un détail
    clickable = this.kind === "events" || this.kind === "history";
    selected = signal<SecurityEvent | null>(null);

    open(row: SecurityRow) {
        this.selected.set(row.raw as SecurityEvent);
        this.detailDialog().nativeElement.showModal();
    }

    close() {
        this.detailDialog().nativeElement.close();
    }

    eventLabel(event: SecurityEvent) {
        return EVENT_LABELS[event.action] ?? event.action;
    }

    eventPath(event: SecurityEvent) {
        const method = event.details?.["method"];
        const path = event.details?.["path"];
        return path ? `${method ? method + " " : ""}${path}` : null;
    }

    headings = computed(() => this.config.headings(this.view()));
    has = (name: "shop" | "email" | "ip" | "period") => this.config.filters.includes(name);

    // filtres de la fenêtre (téléphone) : la boutique, l'adresse IP et la période
    activeFilters = computed(() => {
        const { shopId, ip, from } = this.filters();
        const chips: { key: "shop" | "ip" | "period"; label: string }[] = [];

        if (shopId !== null) chips.push({ key: "shop", label: this.shopName(shopId) });
        if (ip) chips.push({ key: "ip", label: ip });
        if (from) chips.push({ key: "period", label: "Période" });
        return chips;
    });

    filtered = computed(() => this.activeFilters().length > 0 || this.filters().email !== "");

    emptyTitle = computed(() => {
        if (this.filtered()) return "Aucun résultat";
        return this.kind === "locked" ? "Aucun compte bloqué" : "Rien à signaler";
    });

    emptyText = computed(() =>
        this.filtered()
            ? "Essayez d'autres filtres ou une autre période."
            : this.config.emptyText(this.view()),
    );

    errorMessage = computed(() => {
        const err = this.list.error();
        if (err instanceof HttpErrorResponse && err.error?.message) return err.error.message;
        return "Impossible de charger la liste.";
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            clearTimeout(this.emailTimer);
            clearTimeout(this.ipTimer);
        });
    }

    selectView(value: string) {
        if (value === this.view()) return;
        this.view.set(value);
        this.page.set(1);
    }

    // on attend la fin de la frappe avant d'interroger le serveur
    onSearch(value: string) {
        clearTimeout(this.emailTimer);
        this.emailTimer = setTimeout(() => this.setFilter({ email: value.trim() }), 300);
    }

    selectShop(value: string) {
        this.setFilter({ shopId: Number(value) || null });
    }

    onIp(value: string) {
        clearTimeout(this.ipTimer);
        this.ipTimer = setTimeout(() => this.setFilter({ ip: value.trim() }), 300);
    }

    selectRange(range: PeriodRange) {
        this.setFilter({ from: range.from, to: range.to });
    }

    clearFilter(key: "shop" | "ip" | "period") {
        if (key === "shop") this.setFilter({ shopId: null });
        if (key === "ip") this.setFilter({ ip: "" });
        if (key === "period") this.periodFilter()?.selectPeriod("all");
    }

    resetFilters() {
        this.periodFilter()?.selectPeriod("all");
        this.filters.set(NO_FILTERS);
        this.page.set(1);
    }

    exportCsv() {
        this.exporting.set(true);
        this.exportError.set(null);

        const query = this.query({ view: this.view(), filters: this.filters() });
        this.security
            .getCsv(this.config.path, query)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${this.config.exportName}.csv`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url));
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set("Impossible d'exporter la liste.");
                },
            });
    }

    private setFilter(change: Partial<SecurityFilters>) {
        this.filters.update((current) => ({ ...current, ...change }));
        this.page.set(1);
    }

    private shopName(id: number) {
        const shop = this.shops.hasValue() ? this.shops.value().find((s) => s.id === id) : null;
        return shop?.name ?? "Boutique";
    }

    private query(params: {
        view: string;
        filters: SecurityFilters;
        page?: number;
        limit?: number;
    }) {
        const { viewParam } = this.config;
        return {
            filters: params.filters,
            extra: viewParam ? { [viewParam]: params.view } : {},
            page: params.page,
            limit: params.limit,
        };
    }
}

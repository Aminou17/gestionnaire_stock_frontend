import { CashTabs } from "../cash-tabs/cash-tabs";
import { DatePipe, formatDate } from "@angular/common";
import {
    Component,
    LOCALE_ID,
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

import { CashSession, CashSessionPage } from "../../../core/cash/cash.model";
import { CashSessionFilters, CashSessionService } from "../../../core/cash/cash-session.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { ExportFormat } from "../../../core/export-format";
import { ExportMenu } from "../../../shared/export-menu/export-menu";
import { PeriodFilter, PeriodRange } from "../../../shared/period-filter/period-filter";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

const PAGE_SIZE = 20;

@Component({
    selector: "app-cash-sessions",
    imports: [CashTabs, RouterLink, DatePipe, PageHeader, FcfaPipe, PeriodFilter, ExportMenu, Icon],
    templateUrl: "./cash-sessions.html",
    styleUrl: "./cash-sessions.css",
})
export class CashSessions {
    private locale = inject(LOCALE_ID);
    private fcfa = new FcfaPipe();
    private cashService = inject(CashSessionService);
    private router = inject(Router);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    page = signal(1);
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    status = signal<CashSessionFilters["status"]>(null);

    statusChips = [
        { label: "Toutes", value: null },
        { label: "Ouvertes", value: "open" },
        { label: "Avec écart", value: "gap" },
    ] as const;

    private filters = computed<CashSessionFilters>(() => ({
        from: this.range().from,
        to: this.range().to,
        status: this.status(),
    }));
    filtered = computed(() => this.range().period !== "all" || this.status() !== null);

    sessions = rxResource({
        params: () => ({ page: this.page(), filters: this.filters() }),
        stream: ({ params }) =>
            this.cashService.getSessions(params.page, PAGE_SIZE, params.filters),
    });

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectStatus(value: CashSessionFilters["status"]) {
        this.status.set(value);
        this.page.set(1);
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(null);

        this.cashService.exportSessions(this.filters(), format).subscribe({
            next: (file) => {
                this.exporting.set(false);
                const url = URL.createObjectURL(file);
                const link = document.createElement("a");
                link.href = url;
                link.download = `historique-caisses.${format}`;
                link.click();
                URL.revokeObjectURL(url);
            },
            error: () => {
                this.exporting.set(false);
                this.exportError.set("Impossible d'exporter l'historique.");
            },
        });
    }

    // sessions déjà chargées : les pages suivantes s'ajoutent au bout
    list = linkedSignal<CashSessionPage | undefined, CashSession[]>({
        source: () => (this.sessions.hasValue() ? this.sessions.value() : undefined),
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.pagination.page === 1 || !previous) return res.data;

            const known = new Set(previous.value.map((session) => session.id));
            return [...previous.value, ...res.data.filter((session) => !known.has(session.id))];
        },
    });

    // on garde le dernier total pendant le chargement de la page suivante
    total = linkedSignal<CashSessionPage | undefined, number>({
        source: () => (this.sessions.hasValue() ? this.sessions.value() : undefined),
        computation: (res, previous) => res?.pagination.total ?? previous?.value ?? 0,
    });
    firstLoad = computed(() => this.sessions.isLoading() && this.list().length === 0);
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.sessions.isLoading() && this.page() > 1);

    constructor() {
        // charger la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && this.hasMore() && !this.sessions.isLoading()) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });
    }

    // pastille d'état : écart de la clôture, ou caisse encore ouverte
    state(session: CashSession) {
        if (session.status === "OPEN") return { tone: "primary", label: "À clôturer" };
        if (session.explanation_pending) return { tone: "warning", label: "Écart à expliquer" };

        const gap = session.difference ?? 0;
        if (gap === 0) return { tone: "success", label: "Équilibrée" };

        const label = `Écart de ${this.fcfa.transform(gap, true)}`;
        return { tone: gap < 0 ? "danger" : "warning", label };
    }

    // horaires et personnes : "08:00 - 18:30 · Awa" (prénoms, "Awa, puis Hortense" si deux personnes)
    hours(session: CashSession) {
        const start = formatDate(session.opened_at, "HH:mm", this.locale);
        const end = session.closed_at ? formatDate(session.closed_at, "HH:mm", this.locale) : "";
        const range = end ? `${start} - ${end}` : `Ouverte à ${start}`;

        const opener = session.opened_by_name?.split(" ")[0];
        const closer = session.closed_by_name?.split(" ")[0];
        const people =
            closer && opener && closer !== opener ? `${opener}, puis ${closer}` : (opener ?? "");
        return people ? `${range} · ${people}` : range;
    }

    openSession(session: CashSession) {
        this.router.navigate(["/cash/sessions", session.id]);
    }
}

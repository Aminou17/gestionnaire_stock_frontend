import { CashTabs } from "../cash-tabs/cash-tabs";
import { DatePipe, formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, linkedSignal, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { CashSession, CashSessionPage } from "../../../core/cash/cash.model";
import { CashSessionFilters, CashSessionService } from "../../../core/cash/cash-session.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { ExportFormat } from "../../../core/export-format";
import { ExportMenu } from "../../../shared/export-menu/export-menu";
import { PeriodFilter, PeriodRange } from "../../../shared/period-filter/period-filter";
import { Icon } from "../../../shared/icon/icon";
import { Pagination, storedPageSize } from "../../../shared/pagination/pagination";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-cash-sessions",
    imports: [
        CashTabs,
        RouterLink,
        DatePipe,
        PageHeader,
        FcfaPipe,
        PeriodFilter,
        ExportMenu,
        Icon,
        Pagination,
    ],
    templateUrl: "./cash-sessions.html",
    styleUrl: "./cash-sessions.css",
})
export class CashSessions {
    private locale = inject(LOCALE_ID);
    private fcfa = new FcfaPipe();
    private cashService = inject(CashSessionService);
    private router = inject(Router);

    page = signal(1);
    pageSize = storedPageSize("cash-sessions");
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
        params: () => ({ page: this.page(), size: this.pageSize(), filters: this.filters() }),
        stream: ({ params }) =>
            this.cashService.getSessions(params.page, params.size, params.filters),
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

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<CashSessionPage | undefined, CashSessionPage | undefined>({
        source: () => (this.sessions.hasValue() ? this.sessions.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);
    total = computed(() => this.last()?.pagination.total ?? 0);
    firstLoad = computed(() => this.sessions.isLoading() && !this.last());

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

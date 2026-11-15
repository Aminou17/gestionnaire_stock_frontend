import { DatePipe, NgTemplateOutlet, formatDate } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    LOCALE_ID,
    computed,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import {
    ActivityTone,
    LABELS,
    getActivityIcon,
    getActivityTone,
} from "../../shared/activity-label";
import { groupByDay } from "../../shared/day-label";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";
import { UserService } from "../users/user.service";
import { getAuditAuthor, getAuditFirstName } from "../../core/audit/audit-author";
import {
    AuditCategory,
    AuditLog,
    AuditLogPage,
    SECURITY_ACTIONS,
} from "../../core/audit/audit-log.model";
import { AuditLogService } from "../../core/audit/audit-log.service";
import { IconName } from "../../shared/icon/icons";
import {
    AuditChange,
    AuditSentence,
    getAuditChanges,
    getAuditSentence,
} from "../../core/audit/audit-sentence";

const PAGE_SIZE = 25;

type LoadedPage = AuditLogPage & { page: number };

// une ligne du journal ; plusieurs connexions de suite d'une même personne n'en font qu'une
interface Row {
    log: AuditLog;
    times: string[];
    sentence: AuditSentence;
    note: string | null;
    changes: AuditChange[];
    link: (string | number)[] | null;
    initials: string;
    icon: IconName;
    tone: ActivityTone;
    // détail : une feuille s'ouvre seulement s'il y a quelque chose de plus à lire
    hasDetail: boolean;
}

// fiches que l'on peut ouvrir depuis une ligne du journal
const ENTITY_LINKS: Record<string, string> = {
    sale: "/sales",
    product: "/products",
    supplier: "/suppliers",
    user: "/users",
    category: "/categories",
};

const PERIOD_LABELS: Record<string, string> = {
    today: "Aujourd'hui",
    week: "7 derniers jours",
    month: "30 derniers jours",
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Page réservée à l'administrateur (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-audit-logs",
    imports: [RouterLink, DatePipe, NgTemplateOutlet, PageHeader, PeriodFilter, Icon],
    templateUrl: "./audit-logs.html",
    styleUrl: "./audit-logs.css",
    host: { "(document:keydown.escape)": "filtersOpen.set(false); selected.set(null)" },
})
export class AuditLogs {
    private auditService = inject(AuditLogService);
    private userService = inject(UserService);
    private route = inject(ActivatedRoute);
    private locale = inject(LOCALE_ID);
    private periodFilter = viewChild.required<PeriodFilter>("period");
    private searchTimer: ReturnType<typeof setTimeout> | undefined;

    // /audit-logs?result=FAILURE : arrivée depuis la cloche, sur les échecs de sécurité
    private fromAlert = this.route.snapshot.queryParamMap.get("result") === "FAILURE";

    tab = signal<AuditCategory>(this.fromAlert ? "security" : "activity");
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    userId = signal<number | null>(null);
    action = signal<string | null>(null);
    onlyFailures = signal(this.fromAlert);
    search = signal("");
    page = signal(1);
    filtersOpen = signal(false);
    selected = signal<Row | null>(null);

    // les actions de l'onglet, triées par libellé
    actions = computed(() => {
        const security = this.tab() === "security";
        return Object.entries(LABELS)
            .filter(([code]) => SECURITY_ACTIONS.includes(code) === security)
            .map(([code, label]) => ({ code, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    });

    users = rxResource({ stream: () => this.userService.getUsers("all") });

    logs = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            userId: this.userId(),
            action: this.action(),
            result: this.onlyFailures() ? ("FAILURE" as const) : null,
            category: this.tab(),
            search: this.search(),
            page: this.page(),
            limit: PAGE_SIZE,
        }),
        stream: ({ params }) =>
            this.auditService.getLogs(params).pipe(map((res) => ({ ...res, page: params.page }))),
    });

    // compteurs en haut de l'onglet Sécurité, sur la période et la personne choisies
    stats = [
        {
            action: "ACCESS_DENIED",
            one: "accès refusé",
            many: "accès refusés",
            count: this.failureCount("ACCESS_DENIED"),
        },
        {
            action: "AUTH_LOGIN_FAILED",
            one: "connexion échouée",
            many: "connexions échouées",
            count: this.failureCount("AUTH_LOGIN_FAILED"),
        },
    ];

    skeletonRows = [1, 2, 3, 4, 5, 6];

    protected getAuditAuthor = getAuditAuthor;
    protected getAuditFirstName = getAuditFirstName;

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<LoadedPage | undefined, LoadedPage | undefined>({
        source: () => (this.logs.hasValue() ? this.logs.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // la page 1 remplace la liste, les suivantes s'ajoutent sans doublon
    list = linkedSignal<LoadedPage | undefined, AuditLog[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return [];
            if (res.page === 1 || !previous) return res.data;

            const known = new Set(previous.value.map((log) => log.id));
            return [...previous.value, ...res.data.filter((log) => !known.has(log.id))];
        },
    });

    days = computed(() =>
        groupByDay(this.list(), this.locale).map((day) => ({
            key: day.key,
            label: day.label,
            rows: this.toRows(day.items),
        })),
    );

    total = computed(() => this.last()?.pagination.total ?? 0);
    firstLoad = computed(() => this.logs.isLoading() && !this.last());
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.logs.isLoading() && this.page() > 1);
    filtered = computed(() => this.activeFilters().length > 0 || this.search() !== "");

    // les filtres posés, en puces avec croix sous la barre de recherche
    activeFilters = computed(() => {
        const filters: { key: "period" | "user" | "action" | "failures"; label: string }[] = [];
        const { period, from, to } = this.range();

        if (period !== "all")
            filters.push({ key: "period", label: this.periodLabel(period, from, to) });
        if (this.userId() !== null) filters.push({ key: "user", label: this.userName() });
        if (this.action() !== null) {
            filters.push({ key: "action", label: LABELS[this.action()!] ?? "Autre action" });
        }
        if (this.onlyFailures()) filters.push({ key: "failures", label: "Échecs" });

        return filters;
    });

    errorMessage = computed(() => {
        const err = this.logs.error();
        if (err instanceof HttpErrorResponse && err.error?.message) return err.error.message;
        return "Impossible de charger le journal.";
    });

    selectTab(tab: AuditCategory) {
        if (this.tab() === tab) return;
        this.tab.set(tab);
        // une action de l'autre onglet ne donnerait aucun résultat
        this.action.set(null);
        this.onlyFailures.set(false);
        this.page.set(1);
        // pas de lignes de l'ancien onglet pendant le chargement du nouveau
        this.last.set(undefined);
    }

    // on attend la fin de la frappe avant d'interroger le serveur
    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search.set(value.trim());
            this.page.set(1);
        }, 300);
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectUser(value: string) {
        this.userId.set(Number(value) || null);
        this.page.set(1);
    }

    selectAction(value: string) {
        this.action.set(value || null);
        this.page.set(1);
    }

    // un clic sur un compteur filtre la liste, un second clic retire le filtre
    toggleAction(action: string) {
        this.selectAction(this.action() === action ? "" : action);
    }

    setFailures(value: boolean) {
        this.onlyFailures.set(value);
        this.page.set(1);
    }

    clearFilter(key: "period" | "user" | "action" | "failures") {
        if (key === "period") this.periodFilter().selectPeriod("all");
        if (key === "user") this.selectUser("");
        if (key === "action") this.selectAction("");
        if (key === "failures") this.setFailures(false);
    }

    resetFilters() {
        this.periodFilter().selectPeriod("all");
        this.userId.set(null);
        this.action.set(null);
        this.onlyFailures.set(false);
        this.page.set(1);
    }

    reloadStats() {
        for (const stat of this.stats) {
            if (stat.count.error()) stat.count.reload();
        }
    }

    loadMore() {
        this.page.update((page) => page + 1);
    }

    open(row: Row) {
        this.selected.set(row);
    }

    // une adresse IPv4 arrive sous la forme ::ffff:127.0.0.1
    cleanIp(ip: string) {
        return ip.replace(/^::ffff:/, "");
    }

    // deux lettres : "Awa Bazin" donne AB, un email donne ses deux premières lettres
    private initialsOf(author: string) {
        const words = author.split(/[\s@.]+/).filter(Boolean);
        const letters = words.length > 1 ? words[0][0] + words[1][0] : author.slice(0, 2);
        return letters.toUpperCase();
    }

    private userName() {
        const user = this.users.value()?.find((item) => item.id === this.userId());
        return user?.name ?? "Personne";
    }

    private periodLabel(period: string, from: string | null, to: string | null) {
        if (PERIOD_LABELS[period]) return PERIOD_LABELS[period];
        return `${formatDate(from!, "d MMM", this.locale)} au ${formatDate(to!, "d MMM", this.locale)}`;
    }

    private entityLink(log: AuditLog) {
        // une connexion concerne le compte de son auteur, un lien vers lui n'apprend rien
        if (SECURITY_ACTIONS.includes(log.action) && log.action !== "USER_PASSWORD_RESET") {
            return null;
        }
        const path = log.entity_type ? ENTITY_LINKS[log.entity_type] : undefined;
        return path && log.entity_id ? [path, log.entity_id] : null;
    }

    // phrase, modifications et lien calculés une fois par ligne, pas à chaque rendu
    private toRows(logs: AuditLog[]) {
        const groups: { log: AuditLog; times: string[] }[] = [];
        for (const log of logs) {
            const previous = groups.at(-1);
            if (
                log.action === "AUTH_LOGIN_SUCCEEDED" &&
                previous?.log.action === log.action &&
                previous.log.user_id === log.user_id
            ) {
                previous.times.push(log.created_at);
            } else {
                groups.push({ log, times: [log.created_at] });
            }
        }

        return groups.map(({ log, times }): Row => {
            const sentence = getAuditSentence(log);
            const changes = getAuditChanges(log);
            const link = this.entityLink(log);
            const failed = log.result === "FAILURE";
            const author = getAuditAuthor(log);
            return {
                log,
                times,
                sentence,
                note: sentence.note ? capitalize(sentence.note) : null,
                changes,
                link,
                initials: this.initialsOf(author),
                icon: failed ? "alert" : getActivityIcon(log.action),
                tone: getActivityTone(log.action, failed),
                // sans fiche à ouvrir, la ligne montre son détail plutôt que de rester muette
                hasDetail: times.length > 1 || changes.length > 0 || link === null,
            };
        });
    }

    private failureCount(action: string) {
        return rxResource({
            params: () =>
                this.tab() === "security"
                    ? {
                          from: this.range().from,
                          to: this.range().to,
                          userId: this.userId(),
                          action,
                          result: "FAILURE" as const,
                          page: 1,
                          limit: 1,
                      }
                    : undefined,
            stream: ({ params }) =>
                this.auditService.getLogs(params).pipe(map((res) => res.pagination.total)),
        });
    }
}

import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, LOCALE_ID, computed, inject, linkedSignal, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { LABELS } from "../../shared/activity-label";
import { groupByDay } from "../../shared/day-label";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";
import { getInitials } from "../users/user-display";
import { UserService } from "../users/user.service";
import { getAuditAuthor } from "../../core/audit/audit-author";
import {
    AuditCategory,
    AuditLog,
    AuditLogPage,
    SECURITY_ACTIONS,
} from "../../core/audit/audit-log.model";
import { AuditLogService } from "../../core/audit/audit-log.service";
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
    expandable: boolean;
}

// fiches que l'on peut ouvrir depuis une ligne du journal
const ENTITY_LINKS: Record<string, string> = {
    sale: "/sales",
    product: "/products",
    supplier: "/suppliers",
    user: "/users",
    category: "/categories",
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Page réservée au propriétaire (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-audit-logs",
    imports: [RouterLink, DatePipe, NgTemplateOutlet, PageHeader, PeriodFilter, Icon],
    templateUrl: "./audit-logs.html",
    styleUrl: "./audit-logs.css",
})
export class AuditLogs {
    private auditService = inject(AuditLogService);
    private userService = inject(UserService);
    private route = inject(ActivatedRoute);
    private locale = inject(LOCALE_ID);

    // /audit-logs?result=FAILURE : arrivée depuis la cloche, sur les échecs de sécurité
    private fromAlert = this.route.snapshot.queryParamMap.get("result") === "FAILURE";

    tab = signal<AuditCategory>(this.fromAlert ? "security" : "activity");
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    userId = signal<number | null>(null);
    action = signal<string | null>(null);
    onlyFailures = signal(this.fromAlert);
    page = signal(1);

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
    filtered = computed(
        () =>
            this.range().period !== "all" ||
            this.userId() !== null ||
            this.action() !== null ||
            this.onlyFailures(),
    );
    // la période se règle dans son propre sélecteur, Effacer ne la touche pas
    clearable = computed(
        () => this.userId() !== null || this.action() !== null || this.onlyFailures(),
    );

    errorMessage = computed(() => {
        const err = this.logs.error();
        if (err instanceof HttpErrorResponse && err.error?.message) return err.error.message;
        return "Impossible de charger le journal.";
    });

    protected getAuditAuthor = getAuditAuthor;

    selectTab(tab: AuditCategory) {
        if (this.tab() === tab) return;
        this.tab.set(tab);
        // une action de l'autre onglet ne donnerait aucun résultat
        this.action.set(null);
        this.page.set(1);
        // pas de lignes de l'ancien onglet pendant le chargement du nouveau
        this.last.set(undefined);
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

    resetFilters() {
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

    // une tentative sans compte connu n'a pas d'initiales
    initials(log: AuditLog) {
        return log.user_name ? getInitials(log.user_name) : "?";
    }

    // une adresse IPv4 arrive sous la forme ::ffff:127.0.0.1
    cleanIp(ip: string) {
        return ip.replace(/^::ffff:/, "");
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
            return {
                log,
                times,
                sentence,
                note: sentence.note ? capitalize(sentence.note) : null,
                changes,
                link,
                // la ligne s'ouvre seulement si elle a quelque chose de plus à montrer
                expandable: times.length > 1 || changes.length > 0 || link !== null,
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

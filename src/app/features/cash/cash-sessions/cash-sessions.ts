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

import { CashSession, CashSessionPage } from "../../../core/cash/cash.model";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

const PAGE_SIZE = 20;

@Component({
    selector: "app-cash-sessions",
    imports: [RouterLink, DatePipe, PageHeader, FcfaPipe],
    templateUrl: "./cash-sessions.html",
    styleUrl: "./cash-sessions.css",
})
export class CashSessions {
    private cashService = inject(CashSessionService);
    private router = inject(Router);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    page = signal(1);

    sessions = rxResource({
        params: () => ({ page: this.page() }),
        stream: ({ params }) => this.cashService.getSessions(params.page, PAGE_SIZE),
    });

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

    openSession(session: CashSession) {
        this.router.navigate(["/cash/sessions", session.id]);
    }
}

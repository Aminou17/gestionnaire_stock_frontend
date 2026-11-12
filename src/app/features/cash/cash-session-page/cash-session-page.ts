import { DatePipe, formatDate } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, LOCALE_ID, computed, inject } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { CashSessionService } from "../../../core/cash/cash-session.service";
import { summarizeMovements } from "../../../core/cash/cash-movements";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashMovementList } from "../cash-movement-list/cash-movement-list";
import { CloseCashDialog } from "../close-cash-dialog/close-cash-dialog";
import { AuthService } from "../../../core/auth/auth.service";

@Component({
    selector: "app-cash-session-page",
    imports: [RouterLink, DatePipe, PageHeader, Icon, FcfaPipe, CashMovementList, CloseCashDialog],
    templateUrl: "./cash-session-page.html",
    styleUrl: "./cash-session-page.css",
})
export class CashSessionPage {
    private cashService = inject(CashSessionService);
    private auth = inject(AuthService);

    private id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    session = rxResource({
        params: () => this.id(),
        stream: ({ params }) => this.cashService.getSession(params),
    });

    private locale = inject(LOCALE_ID);

    data = computed(() => (this.session.hasValue() ? this.session.value() : undefined));
    // celui qui a compté explique l'écart ; le propriétaire peut aussi le faire
    canExplain = computed(
        () => this.auth.isAdmin() || this.data()?.closed_by === this.auth.user()?.id,
    );

    title = computed(() => {
        const session = this.data();
        return session ? formatDate(session.session_date, "d MMMM y", this.locale) : "Caisse";
    });
    summary = computed(() => summarizeMovements(this.data()?.movements ?? []));

    notFound = computed(() => {
        const err = this.session.error();
        return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400);
    });

    print() {
        const title = document.title;
        document.title = `Caisse-${this.data()?.session_date}`;
        window.print();
        document.title = title;
    }

    errorMessage = computed(() =>
        this.notFound() ? "Cette caisse est introuvable." : "Impossible de charger cette caisse.",
    );
}

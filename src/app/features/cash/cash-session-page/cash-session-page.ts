import { DatePipe, formatDate } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, LOCALE_ID, computed, inject, signal } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { summarizeMovements } from "../../../core/cash/cash-movements";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashMovementList } from "../cash-movement-list/cash-movement-list";
import { ReopenCashDialog } from "../reopen-cash-dialog/reopen-cash-dialog";
import { CloseCashDialog } from "../close-cash-dialog/close-cash-dialog";
import { AuthService } from "../../../core/auth/auth.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { MoneyToggle } from "../../../shared/money/money-toggle";

@Component({
    selector: "app-cash-session-page",
    imports: [
        MoneyToggle,
        RouterLink,
        DatePipe,
        PageHeader,
        Icon,
        FcfaPipe,
        CashMovementList,
        CloseCashDialog,
        ReopenCashDialog,
    ],
    templateUrl: "./cash-session-page.html",
    styleUrl: "./cash-session-page.css",
    host: { "[class.ticket-mode]": "ticketMode()" },
})
export class CashSessionPage {
    private cashService = inject(CashSessionService);
    protected auth = inject(AuthService);
    protected shopName = inject(ShopSettingsService).shopName;

    // retour vers la page d'où l'on vient (Caisse ou Historique), sinon l'historique
    private back = getBackLink("/cash/sessions", "Retour à l'historique");
    protected backUrl = inject(Router).serializeUrl(this.back.link);
    protected backLabel = this.back.label;

    private id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    session = rxResource({
        params: () => this.id(),
        stream: ({ params }) => this.cashService.getSession(params),
    });

    private locale = inject(LOCALE_ID);

    data = computed(() => (this.session.hasValue() ? this.session.value() : undefined));
    // celui qui a compté explique l'écart ; l'administrateur peut aussi le faire
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

    // le ticket étroit remplace la page le temps de l'impression
    ticketMode = signal(false);

    printTicket() {
        this.ticketMode.set(true);

        setTimeout(() => {
            window.print();
            this.ticketMode.set(false);
        });
    }

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

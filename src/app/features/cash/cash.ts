import { CashTabs } from "./cash-tabs/cash-tabs";
import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { CashSessionService } from "../../core/cash/cash-session.service";
import { summarizeMovements } from "../../core/cash/cash-movements";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { CashMovementDialog } from "./cash-movement-dialog/cash-movement-dialog";
import { CashMovementList } from "./cash-movement-list/cash-movement-list";
import { CloseCashDialog } from "./close-cash-dialog/close-cash-dialog";
import { OpenCashDialog } from "./open-cash-dialog/open-cash-dialog";
import { MoneyToggle } from "../../shared/money/money-toggle";

// heure à partir de laquelle on rappelle de clôturer la caisse
const CLOSING_REMINDER_HOUR = 19;

@Component({
    selector: "app-cash",
    imports: [
        MoneyToggle,
        CashTabs,
        RouterLink,
        DatePipe,
        PageHeader,
        Icon,
        FcfaPipe,
        CashMovementList,
        CashMovementDialog,
        CloseCashDialog,
        OpenCashDialog,
    ],
    templateUrl: "./cash.html",
    styleUrl: "./cash.css",
})
export class Cash {
    // la fiche d'une caisse ramène ici avec le bouton Retour
    protected backState = { backTo: "/cash", backLabel: "Retour à la caisse" };

    private cashService = inject(CashSessionService);
    protected auth = inject(AuthService);

    today = rxResource({ stream: () => this.cashService.getToday() });

    // détail de la session du jour : mouvements et montants de clôture
    session = rxResource({
        params: () => (this.today.hasValue() ? this.today.value().cash?.id : undefined),
        stream: ({ params }) => this.cashService.getSession(params),
    });

    // dernière caisse clôturée de la personne, pour l'écran sans caisse ouverte
    lastClosed = rxResource({
        stream: () =>
            this.cashService
                .getSessions(1, 10)
                .pipe(
                    map(
                        (res) =>
                            res.data.find(
                                (item) =>
                                    item.status === "CLOSED" &&
                                    item.opened_by === this.auth.user()?.id,
                            ) ?? null,
                    ),
                ),
    });

    cash = computed(() => (this.today.hasValue() ? this.today.value().cash : null));
    previous = computed(() =>
        this.today.hasValue() ? this.today.value().previousOpenSession : null,
    );
    pending = computed(() =>
        this.today.hasValue() ? this.today.value().pendingExplanation : null,
    );
    // celui qui a compté explique l'écart ; l'administrateur peut aussi le faire
    canExplain = computed(
        () => this.auth.isAdmin() || this.pending()?.closedBy === this.auth.user()?.id,
    );
    team = computed(() => (this.today.hasValue() ? (this.today.value().teamSessions ?? []) : []));
    // une caisse oubliée ou un écart non expliqué empêchent d'en ouvrir une nouvelle
    blocker = computed(() => {
        const previous = this.previous();
        if (previous && this.isOwn(previous.openedBy)) {
            return `Clôturez d'abord votre caisse du ${this.shortDate(previous.sessionDate)}.`;
        }

        const pending = this.pending();
        if (pending && this.isOwn(pending.closedBy)) {
            return `Expliquez d'abord l'écart de votre caisse du ${this.shortDate(pending.sessionDate)}.`;
        }

        return null;
    });
    isOwn = (userId: number) => userId === this.auth.user()?.id;

    // caisse du jour pas encore ouverte : ce qui bloque SA propre caisse se règle dans la carte,
    // avec un seul bouton, au lieu d'un bandeau en plus
    ownPrevious = computed(() => {
        const previous = this.previous();
        return !this.cash() && previous && this.isOwn(previous.openedBy) ? previous : null;
    });
    ownPending = computed(() => {
        const pending = this.pending();
        return !this.cash() && pending && this.isOwn(pending.closedBy) ? pending : null;
    });
    isOpen = computed(() => this.cash()?.status === "OPEN");

    // le soir, on rappelle de compter le tiroir pour ne pas oublier la clôture
    closingTime = computed(() => this.isOpen() && new Date().getHours() >= CLOSING_REMINDER_HOUR);

    movements = computed(() => (this.session.hasValue() ? this.session.value().movements : []));
    // les plus récents en premier, comme un ticket de caisse qui défile
    latest = computed(() => [...this.movements()].reverse());
    summary = computed(() => summarizeMovements(this.movements()));

    // la date vient du détail de la session : le serveur et le navigateur peuvent différer d'un jour
    closeDate = computed(() =>
        this.session.hasValue() ? this.session.value().session_date : null,
    );

    protected shortDate(date: string) {
        return new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
        });
    }

    reload() {
        this.today.reload();
        this.session.reload();
    }
}

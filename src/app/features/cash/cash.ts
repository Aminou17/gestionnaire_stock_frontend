import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { CashSessionService } from "../../core/cash/cash-session.service";
import { summarizeMovements } from "../../core/cash/cash-movements";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { CashMovementDialog } from "./cash-movement-dialog/cash-movement-dialog";
import { CashMovementList } from "./cash-movement-list/cash-movement-list";
import { CountCashDialog } from "./count-cash-dialog/count-cash-dialog";
import { UncountedCashNotice } from "./uncounted-cash-notice/uncounted-cash-notice";
import { MoneyToggle } from "../../shared/money/money-toggle";

// Heure à partir de laquelle on rappelle de compter la caisse
const COUNTING_REMINDER_HOUR = 19;

@Component({
    selector: "app-cash",
    imports: [
        MoneyToggle,
        RouterLink,
        DatePipe,
        PageHeader,
        Icon,
        FcfaPipe,
        CashMovementList,
        CashMovementDialog,
        CountCashDialog,
        UncountedCashNotice,
    ],
    templateUrl: "./cash.html",
    styleUrl: "./cash.css",
})
export class Cash {
    // La fiche d'une caisse ramène ici avec le bouton Retour
    protected backState = { backTo: "/cash", backLabel: "Retour à la caisse" };

    private cashService = inject(CashSessionService);
    protected auth = inject(AuthService);

    today = rxResource({ stream: () => this.cashService.getToday() });

    // Détail de la session du jour : mouvements et montants du comptage
    session = rxResource({
        params: () => (this.today.hasValue() ? this.today.value().cash?.id : undefined),
        stream: ({ params }) => this.cashService.getSession(params),
    });

    cash = computed(() => (this.today.hasValue() ? this.today.value().cash : null));
    // Caisse d'un jour passé jamais comptée : un rappel, rien n'est bloqué
    uncounted = computed(() =>
        this.today.hasValue() ? this.today.value().uncountedSession : null,
    );
    // Fond de départ tant que la caisse du jour n'existe pas
    expectedOpening = computed(() =>
        this.today.hasValue() ? this.today.value().expectedOpening : null,
    );
    isOpen = computed(() => this.cash()?.status === "OPEN");
    isCounted = computed(() => this.cash()?.status === "CLOSED");

    // Le soir, on rappelle de compter le tiroir pour ne pas oublier
    countingTime = computed(() => this.isOpen() && new Date().getHours() >= COUNTING_REMINDER_HOUR);

    movements = computed(() => (this.session.hasValue() ? this.session.value().movements : []));
    // Les plus récents en premier, comme un ticket de caisse qui défile
    latest = computed(() => [...this.movements()].reverse());
    summary = computed(() => summarizeMovements(this.movements()));

    // Tout ce qui est sorti du tiroir : remboursements, dépenses et retraits
    spent = computed(() => {
        const { refunds, expenses, withdrawals } = this.summary();
        return refunds + expenses + withdrawals;
    });

    // La fiche de sa propre caisse ouverte renvoie ici : pas de lien dans ce cas
    hasSheet = computed(() => {
        if (!this.session.hasValue()) return false;
        const { status, opened_by } = this.session.value();
        return status !== "OPEN" || opened_by !== this.auth.user()?.id;
    });

    reload() {
        this.today.reload();
        this.session.reload();
    }
}

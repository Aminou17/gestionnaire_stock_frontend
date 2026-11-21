import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { CashClosedNotice } from "../../cash/cash-closed-notice/cash-closed-notice";
import { CloseCashDialog } from "../../cash/close-cash-dialog/close-cash-dialog";
import { OpenCashDialog } from "../../cash/open-cash-dialog/open-cash-dialog";
import { ReopenCashDialog } from "../../cash/reopen-cash-dialog/reopen-cash-dialog";
import { AuthService } from "../../../core/auth/auth.service";
import { resizeReceipt } from "../../../shared/receipt-resizer";
import { getBackLink } from "../../../core/back-link";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { EXPENSE_CATEGORIES, expenseCategory } from "../../../core/cash/expense-look";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { ToastService } from "../../../shared/toast/toast.service";

// exemples de précision selon le motif choisi
const PLACEHOLDERS: Record<string, string> = {
    SUPPLIES: "Ex. Sachets et rouleau de ticket",
    TRANSPORT: "Ex. Taxi pour livrer un client",
    FOOD: "Ex. Déjeuner de l'équipe",
    SALARY: "Ex. Avance sur salaire de Moussa",
    BILLS: "Ex. Facture d'électricité de novembre",
    REPAIR: "Ex. Réparation de la porte",
    OTHER: "Ex. Dépense exceptionnelle",
};

import { BackLink, injectGoBack } from "../../../shared/back-link/back-link";
@Component({
    selector: "app-new-expense",
    imports: [
        BackLink,
        PageHeader,
        Icon,
        FcfaPipe,
        CashClosedNotice,
        OpenCashDialog,
        CloseCashDialog,
        ReopenCashDialog,
    ],
    templateUrl: "./new-expense.html",
    styleUrl: "./new-expense.css",
})
export class NewExpense {
    private movements = inject(CashMovementService);
    private cashService = inject(CashSessionService);
    protected auth = inject(AuthService);
    private toast = inject(ToastService);
    private destroyRef = inject(DestroyRef);

    protected back = getBackLink("/expenses", "Dépenses");
    private goBack = injectGoBack();
    protected categories = EXPENSE_CATEGORIES;
    protected quickAmounts = [500, 1000, 2000, 5000];

    amount = signal<number | null>(null);
    // pas de motif choisi d'office : une dépense mal classée fausserait le relevé
    category = signal<string | null>(null);
    receipt = signal<string | null>(null);
    receiptError = signal<string | null>(null);
    reason = signal("");
    saving = signal(false);
    error = signal<string | null>(null);
    // les messages de champ ne s'affichent qu'après un premier essai
    tried = signal(false);

    // la dépense sort du tiroir de sa propre caisse du jour
    today = rxResource({ stream: () => this.cashService.getToday() });
    cash = computed(() => (this.today.hasValue() ? this.today.value().cash : null));
    cashOpen = computed(() => this.cash()?.status === "OPEN");
    // une caisse oubliée d'un jour passé empêche d'ouvrir celle d'aujourd'hui
    ownPrevious = computed(() => {
        const previous = this.today.hasValue() ? this.today.value().previousOpenSession : null;
        return previous && previous.openedBy === this.auth.user()?.id ? previous : null;
    });
    gateState = computed(() =>
        this.cash() ? "closedToday" : this.ownPrevious() ? "previous" : "notOpened",
    );

    chosen = computed(() => expenseCategory(this.category()));
    placeholder = computed(() => PLACEHOLDERS[this.category() ?? ""] ?? "");

    amountValid = computed(() => {
        const amount = this.amount();
        return amount !== null && Number.isInteger(amount) && amount >= 1;
    });

    // solde du tiroir après la dépense, quand il est connu
    balanceAfter = computed(() => {
        const balance = this.cash()?.balance;
        const amount = this.amount();
        if (balance === null || balance === undefined || !this.amountValid()) return null;
        return balance - amount!;
    });

    async onReceipt(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        this.receiptError.set(null);
        try {
            this.receipt.set(await resizeReceipt(file));
        } catch (err) {
            this.receiptError.set((err as Error).message);
        }
    }

    onAmount(value: string) {
        const digits = value.replace(/\D/g, "");
        this.amount.set(digits ? Number(digits) : null);
    }

    addAmount(value: number) {
        this.amount.set((this.amount() ?? 0) + value);
    }

    submit() {
        if (this.saving()) return;
        this.tried.set(true);
        if (!this.amountValid() || !this.category()) return;

        this.saving.set(true);
        this.error.set(null);

        this.movements
            .create(
                "EXPENSE",
                this.amount()!,
                this.category()!,
                this.reason().trim(),
                this.receipt(),
            )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.toast.show("Dépense enregistrée");
                    // le formulaire quitte l'historique : la touche retour ne le rouvre pas
                    this.goBack(this.back.link);
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible d'enregistrer la dépense.");
                    // la caisse a pu être clôturée entre-temps
                    if (err.status === 409) this.today.reload();
                },
            });
    }
}

import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

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

@Component({
    selector: "app-new-expense",
    imports: [RouterLink, PageHeader, Icon, FcfaPipe],
    templateUrl: "./new-expense.html",
    styleUrl: "./new-expense.css",
})
export class NewExpense {
    private movements = inject(CashMovementService);
    private cashService = inject(CashSessionService);
    private toast = inject(ToastService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    protected back = getBackLink("/expenses", "Dépenses");
    protected categories = EXPENSE_CATEGORIES;
    protected quickAmounts = [500, 1000, 2000, 5000];

    amount = signal<number | null>(null);
    category = signal("SUPPLIES");
    reason = signal("");
    saving = signal(false);
    error = signal<string | null>(null);
    // les messages de champ ne s'affichent qu'après un premier essai
    tried = signal(false);

    // la dépense sort du tiroir de sa propre caisse du jour
    today = rxResource({ stream: () => this.cashService.getToday() });
    cash = computed(() => (this.today.hasValue() ? this.today.value().cash : null));
    cashOpen = computed(() => this.cash()?.status === "OPEN");

    chosen = computed(() => expenseCategory(this.category()));
    placeholder = computed(() => PLACEHOLDERS[this.category()] ?? "");

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
        if (!this.amountValid()) return;

        this.saving.set(true);
        this.error.set(null);

        this.movements
            .create("EXPENSE", this.amount()!, this.category(), this.reason().trim())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.toast.show("Dépense enregistrée");
                    this.router.navigateByUrl(this.back.link);
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

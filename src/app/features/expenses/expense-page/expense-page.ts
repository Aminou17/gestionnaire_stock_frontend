import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { HttpErrorResponse } from "@angular/common/http";
import { ToastService } from "../../../shared/toast/toast.service";
import { getBackLink } from "../../../core/back-link";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { expenseCategory } from "../../../core/cash/expense-look";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-expense-page",
    imports: [DatePipe, RouterLink, PageHeader, Icon, FcfaPipe],
    templateUrl: "./expense-page.html",
    styleUrl: "./expense-page.css",
})
export class ExpensePage {
    private movements = inject(CashMovementService);
    private route = inject(ActivatedRoute);
    private toast = inject(ToastService);

    protected back = getBackLink("/expenses", "Dépenses");
    // La fiche de la caisse ramène ici
    protected backState = { backTo: "", backLabel: "Dépense" };

    private id = Number(this.route.snapshot.paramMap.get("id"));

    expense = rxResource({
        params: () => (Number.isInteger(this.id) && this.id > 0 ? this.id : undefined),
        stream: ({ params }) => this.movements.getMovement(params),
    });

    // Un autre type de mouvement n'a rien à faire sur cette page
    notExpense = computed(() => this.expense.hasValue() && this.expense.value().type !== "EXPENSE");
    look = computed(() =>
        expenseCategory(this.expense.hasValue() ? this.expense.value().reason_category : null),
    );

    confirming = signal(false);
    cancelling = signal(false);
    cancelError = signal<string | null>(null);

    // L'argent revient dans le tiroir ; la ligne reste, marquée annulée
    cancel() {
        this.cancelling.set(true);
        this.cancelError.set(null);

        this.movements.cancelExpense(this.id).subscribe({
            next: () => {
                this.cancelling.set(false);
                this.confirming.set(false);
                this.toast.show("Dépense annulée");
                this.expense.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.cancelling.set(false);
                this.cancelError.set(err.error?.message ?? "Impossible d'annuler la dépense.");
            },
        });
    }

    constructor() {
        this.backState.backTo = `/expenses/${this.id}`;
    }
}

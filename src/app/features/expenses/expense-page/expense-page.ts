import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";

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

    protected back = getBackLink("/expenses", "Dépenses");
    // la fiche de la caisse ramène ici
    protected backState = { backTo: "", backLabel: "Dépense" };

    private id = Number(this.route.snapshot.paramMap.get("id"));

    expense = rxResource({
        params: () => (Number.isInteger(this.id) && this.id > 0 ? this.id : undefined),
        stream: ({ params }) => this.movements.getMovement(params),
    });

    // un autre type de mouvement n'a rien à faire sur cette page
    notExpense = computed(() => this.expense.hasValue() && this.expense.value().type !== "EXPENSE");
    look = computed(() =>
        expenseCategory(this.expense.hasValue() ? this.expense.value().reason_category : null),
    );

    constructor() {
        this.backState.backTo = `/expenses/${this.id}`;
    }
}

import { DatePipe } from "@angular/common";
import { Component, inject, input } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { CashMovement } from "../../../core/cash/cash.model";
import { getMovementLabel, isIncome } from "../../../core/cash/cash-movements";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-cash-movement-list",
    imports: [RouterLink, DatePipe, Icon, FcfaPipe],
    templateUrl: "./cash-movement-list.html",
    styleUrl: "./cash-movement-list.css",
})
export class CashMovementList {
    movements = input.required<CashMovement[]>();
    emptyText = input("Aucun mouvement pour le moment.");
    showSeller = input(true);
    // la page des mouvements mélange plusieurs jours
    showDate = input(false);

    private router = inject(Router);

    // la vente ouverte depuis la liste ramène ici avec le bouton Retour
    backState() {
        return { backTo: this.router.url, backLabel: this.backLabel() };
    }

    backLabel = input("Caisse");

    label = getMovementLabel;
    income = isIncome;
}

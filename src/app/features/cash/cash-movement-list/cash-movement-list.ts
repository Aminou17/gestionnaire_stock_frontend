import { DatePipe } from "@angular/common";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { CashMovement } from "../../../core/cash/cash.model";
import { getMovementLabel, isIncome } from "../../../core/cash/cash-movements";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-cash-movement-list",
    imports: [RouterLink, DatePipe, Icon, FcfaPipe],
    templateUrl: "./cash-movement-list.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./cash-movement-list.css"],
})
export class CashMovementList {
    movements = input.required<CashMovement[]>();
    emptyText = input("Aucun mouvement pour le moment.");
    // la page des mouvements mélange plusieurs jours
    showDate = input(false);

    private router = inject(Router);

    // la vente ouverte depuis la liste ramène ici avec le bouton Retour
    backState() {
        return { backTo: this.router.url, backLabel: this.backLabel() };
    }

    backLabel = input("Caisse");

    // seules les ventes et leurs remboursements ont une fiche à ouvrir
    hasSale(movement: CashMovement) {
        return movement.type === "SALE" || movement.reference_type === "SALE_CANCELLATION";
    }

    protected selected = signal<CashMovement | null>(null);
    private detail = viewChild.required<ElementRef<HTMLDialogElement>>("detail");

    open(movement: CashMovement) {
        this.selected.set(movement);
        this.detail().nativeElement.showModal();
    }

    close() {
        this.detail().nativeElement.close();
    }

    // ne rien renvoyer ici : Angular annule le clic si le gestionnaire renvoie false
    onBackdropClick(event: MouseEvent) {
        if (event.target === this.detail().nativeElement) {
            this.close();
        }
    }

    label = getMovementLabel;
    income = isIncome;
}

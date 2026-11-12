import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";

import { BackState } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import {
    MOVEMENT_TYPES,
    StockMovement,
    isInventoryMovement,
    isOutgoingMovement,
} from "../../../core/stock/stock-movement.model";

// Fenêtre de détail d'un mouvement, utilisée par la liste et par la fiche produit
@Component({
    selector: "app-movement-detail",
    imports: [RouterLink, DatePipe, DecimalPipe],
    templateUrl: "./movement-detail.html",
    styleUrl: "./movement-detail.css",
})
export class MovementDetail {
    protected auth = inject(AuthService);
    protected types = MOVEMENT_TYPES;
    protected isInventory = isInventoryMovement;

    movement = input<StockMovement | null>(null);
    backState = input.required<BackState>();

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    stockBefore = computed(() => {
        const movement = this.movement();
        if (!movement) return null;
        const change = isOutgoingMovement(movement) ? -movement.quantity : movement.quantity;
        return movement.stock_after - change;
    });

    // une entrée ne mène nulle part : la page des entrées n'a pas de fiche
    saleId(movement: StockMovement) {
        return movement.type === "ENTRY" || isInventoryMovement(movement)
            ? null
            : movement.reference_id;
    }

    show() {
        this.dialog().nativeElement.showModal();
    }

    close() {
        this.dialog().nativeElement.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }
}

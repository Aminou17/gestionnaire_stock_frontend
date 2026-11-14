import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";

import { BackState } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import {
    MOVEMENT_TYPES,
    StockMovement,
    adjustmentReasonLabel,
    isInventoryMovement,
    isManualMovement,
    isOutgoingMovement,
    saleId,
} from "../../../core/stock/stock-movement.model";
import { Icon } from "../../../shared/icon/icon";

// Fenêtre de détail d'un mouvement, utilisée par la liste et par la fiche produit
@Component({
    selector: "app-movement-detail",
    imports: [RouterLink, DatePipe, DecimalPipe, Icon],
    templateUrl: "./movement-detail.html",
    styleUrl: "./movement-detail.css",
})
export class MovementDetail {
    protected auth = inject(AuthService);
    protected types = MOVEMENT_TYPES;
    protected isInventory = isInventoryMovement;
    protected isManual = isManualMovement;
    protected reasonLabel = adjustmentReasonLabel;
    protected saleId = saleId;

    movement = input<StockMovement | null>(null);
    backState = input.required<BackState>();

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    stockBefore = computed(() => {
        const movement = this.movement();
        if (!movement) return null;
        const change = isOutgoingMovement(movement) ? -movement.quantity : movement.quantity;
        return movement.stock_after - change;
    });

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

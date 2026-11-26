import { DatePipe, DecimalPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, input, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { BackState } from "../../../core/back-link";
import { MovementDetail } from "../../stock-movements/movement-detail/movement-detail";
import {
    MOVEMENT_TYPES,
    StockMovement,
    adjustmentReasonLabel,
    isInventoryMovement,
    isManualMovement,
} from "../../../core/stock/stock-movement.model";
import { StockMovementService } from "../../../core/stock/stock-movement.service";

// Derniers mouvements d'un produit, en bas de sa fiche
@Component({
    selector: "app-product-movements",
    imports: [RouterLink, DatePipe, DecimalPipe, MovementDetail],
    templateUrl: "./product-movements.html",
    styleUrl: "./product-movements.css",
})
export class ProductMovements {
    private movementService = inject(StockMovementService);

    productId = input.required<number>();

    // La vente ouverte revient sur la fiche de ce produit
    private router = inject(Router);
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Produit" };
    }

    protected types = MOVEMENT_TYPES;
    protected isInventory = isInventoryMovement;
    protected isManual = isManualMovement;
    protected reasonLabel = adjustmentReasonLabel;

    private detailDialog = viewChild.required<MovementDetail>("detail");
    selected = signal<StockMovement | null>(null);

    open(movement: StockMovement) {
        this.selected.set(movement);
        this.detailDialog().show();
    }

    movements = rxResource({
        params: () => this.productId(),
        stream: ({ params }) =>
            this.movementService.getMovements({
                from: null,
                to: null,
                type: null,
                productId: params,
                page: 1,
                limit: 3,
            }),
    });

    reload() {
        this.movements.reload();
    }

    list = computed(() => (this.movements.hasValue() ? this.movements.value().data : []));
    total = computed(() => (this.movements.hasValue() ? this.movements.value().total : 0));

    errorMessage = computed(() => {
        const err = this.movements.error();
        if (err instanceof HttpErrorResponse && err.error?.message) return err.error.message;
        return "Impossible de charger les mouvements.";
    });
}

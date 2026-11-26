import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";

// Confirmation avant d'annuler un inventaire qui n'a pas encore corrigé le stock
@Component({
    selector: "app-inventory-cancel-dialog",
    templateUrl: "./inventory-cancel-dialog.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-cancel-dialog.css"],
})
export class InventoryCancelDialog {
    private inventoryService = inject(InventoryService);
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    inventory = input.required<Inventory>();
    cancelled = output<Inventory>();

    busy = signal(false);
    error = signal("");

    open() {
        this.error.set("");
        this.dialog().nativeElement.showModal();
    }

    // Un clic à côté de la fenêtre la ferme
    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    // Échap ne ferme pas la fenêtre pendant l'envoi
    onCancel(event: Event) {
        if (this.busy()) event.preventDefault();
    }

    close() {
        if (!this.busy()) this.dialog().nativeElement.close();
    }

    confirm() {
        if (this.busy()) return;

        this.busy.set(true);
        this.error.set("");

        this.inventoryService.cancel(this.inventory().id).subscribe({
            next: ({ inventory }) => {
                this.busy.set(false);
                this.dialog().nativeElement.close();
                this.cancelled.emit(inventory);
            },
            error: (err: HttpErrorResponse) => {
                this.busy.set(false);
                this.error.set(err.error?.message ?? "L'inventaire n'a pas pu être annulé.");
            },
        });
    }
}

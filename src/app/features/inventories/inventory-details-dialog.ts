import { DatePipe } from "@angular/common";
import { Component, ElementRef, input, viewChild } from "@angular/core";

import { Inventory } from "../../core/stock/inventory.model";

// Qui a ouvert, compté, corrigé ou annulé l'inventaire, et quand
@Component({
    selector: "app-inventory-details-dialog",
    imports: [DatePipe],
    templateUrl: "./inventory-details-dialog.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-details-dialog.css"],
})
export class InventoryDetailsDialog {
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    inventory = input.required<Inventory>();

    open() {
        this.dialog().nativeElement.showModal();
    }

    close() {
        this.dialog().nativeElement.close();
    }

    // un clic à côté de la fenêtre la ferme
    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }
}

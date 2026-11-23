import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

import { Inventory, InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";

// Corriger la quantité comptée d'un produit (administrateur, comptage à valider)
@Component({
    selector: "app-inventory-line-dialog",
    templateUrl: "./inventory-line-dialog.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-line-dialog.css"],
})
export class InventoryLineDialog {
    private inventoryService = inject(InventoryService);
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    inventory = input.required<Inventory>();
    saved = output<Inventory>();

    line = signal<InventoryItem | null>(null);
    value = signal("");
    saving = signal(false);
    error = signal("");

    open(line: InventoryItem) {
        this.line.set(line);
        this.value.set(String(line.actualStock ?? ""));
        this.error.set("");
        this.dialog().nativeElement.showModal();
    }

    // un clic à côté de la fenêtre la ferme
    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    // Échap ne ferme pas la fenêtre pendant l'envoi
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    close() {
        if (!this.saving()) this.dialog().nativeElement.close();
    }

    onInput(event: Event) {
        const field = event.target as HTMLInputElement;
        const digits = field.value.replace(/\D/g, "").slice(0, 7);

        field.value = digits;
        this.value.set(digits);
    }

    save() {
        const line = this.line();
        if (!line || this.value() === "" || this.saving()) return;

        this.run(
            this.inventoryService.saveItems(this.inventory().id, [
                { productId: line.productId, actualStock: Number(this.value()) },
            ]),
        );
    }

    // retire le produit du comptage
    remove() {
        const line = this.line();
        if (!line || this.saving()) return;

        this.run(this.inventoryService.removeItem(this.inventory().id, line.productId));
    }

    private run(request: ReturnType<InventoryService["removeItem"]>) {
        this.saving.set(true);
        this.error.set("");

        request.subscribe({
            next: ({ inventory }) => {
                this.saving.set(false);
                this.dialog().nativeElement.close();
                this.saved.emit(inventory);
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "La quantité n'a pas pu être enregistrée.");
            },
        });
    }
}

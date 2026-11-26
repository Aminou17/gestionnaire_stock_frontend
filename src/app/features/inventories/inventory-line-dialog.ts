import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

import { Inventory, InventoryItem, ItemReason } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { REASONS } from "./inventory-look";

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

    protected reasons = REASONS;

    line = signal<InventoryItem | null>(null);
    reason = signal<ItemReason | null>(null);
    value = signal("");
    saving = signal(false);
    error = signal("");

    open(line: InventoryItem) {
        this.line.set(line);
        this.value.set(String(line.actualStock ?? ""));
        this.reason.set(line.reason);
        this.error.set("");
        this.dialog().nativeElement.showModal();
    }

    // Un clic à côté de la fenêtre la ferme
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

    // La même raison touchée deux fois est effacée
    pickReason(reason: ItemReason) {
        this.reason.set(this.reason() === reason ? null : reason);
    }

    // La raison n'a de sens que sur un écart
    hasGap = () => !!this.line()?.difference;

    save() {
        const line = this.line();
        if (!line || this.value() === "" || this.saving()) return;

        const quantity = Number(this.value());
        const reasonChanged = this.hasGap() && this.reason() !== line.reason;
        const id = this.inventory().id;

        const saveQuantity = quantity !== line.actualStock;
        if (!saveQuantity && !reasonChanged) {
            this.close();
            return;
        }

        this.saving.set(true);
        this.error.set("");

        // La quantité d'abord, puis la raison ; la page se recharge ensuite
        const quantity$ = saveQuantity
            ? this.inventoryService.saveItems(id, [
                  { productId: line.productId, actualStock: quantity },
              ])
            : null;
        const reason$ = () => this.inventoryService.setReason(id, line.productId, this.reason());

        const done = (inventory: Inventory) => {
            this.saving.set(false);
            this.dialog().nativeElement.close();
            this.saved.emit(inventory);
        };
        const fail = (err: HttpErrorResponse) => {
            this.saving.set(false);
            this.error.set(err.error?.message ?? "Les changements n'ont pas pu être enregistrés.");
        };

        if (quantity$) {
            quantity$.subscribe({
                next: ({ inventory }) => {
                    if (!reasonChanged) return done(inventory);
                    reason$().subscribe({ next: () => done(inventory), error: fail });
                },
                error: fail,
            });
        } else {
            reason$().subscribe({ next: () => done(this.inventory()), error: fail });
        }
    }

    // Retire le produit du comptage
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

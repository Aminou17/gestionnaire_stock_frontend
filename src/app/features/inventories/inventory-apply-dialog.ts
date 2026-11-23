import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

import { ApplyResult, Inventory, MovementsSince } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { ageText, isOld } from "./inventory-look";

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

// Confirmation de la correction du stock : elle dit ce qui va changer et combien de ventes
// ont eu lieu depuis le comptage (le serveur les prend en compte)
@Component({
    selector: "app-inventory-apply-dialog",
    templateUrl: "./inventory-apply-dialog.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./inventory-apply-dialog.css"],
})
export class InventoryApplyDialog {
    private inventoryService = inject(InventoryService);
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    inventory = input.required<Inventory>();
    applied = output<ApplyResult>();

    movements = signal<MovementsSince | null>(null);
    movementsFailed = signal(false);
    applying = signal(false);
    error = signal("");

    open() {
        this.error.set("");
        this.movements.set(null);
        this.movementsFailed.set(false);
        this.dialog().nativeElement.showModal();

        this.inventoryService.getMovementsSince(this.inventory().id).subscribe({
            next: (movements) => this.movements.set(movements),
            error: () => this.movementsFailed.set(true),
        });
    }

    // un comptage de plus d'un jour : on le dit au moment de corriger
    old = () => isOld(this.inventory());
    age = () => ageText(this.inventory());

    // un clic à côté de la fenêtre la ferme
    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    // Échap ne ferme pas la fenêtre pendant l'envoi
    onCancel(event: Event) {
        if (this.applying()) event.preventDefault();
    }

    close() {
        if (!this.applying()) this.dialog().nativeElement.close();
    }

    // ce qui s'est passé depuis le comptage, en phrases courtes
    movementLines() {
        const totals = this.movements()?.totals;
        if (!totals) return [];

        const lines: string[] = [];
        const add = (movements: number, units: number, one: string, many: string) => {
            if (movements > 0) {
                lines.push(
                    `${movements} ${plural(movements, one, many)} (${units} unité${units > 1 ? "s" : ""})`,
                );
            }
        };

        add(totals.sales.movements, totals.sales.units, "vente", "ventes");
        add(totals.returns.movements, totals.returns.units, "remboursement", "remboursements");
        add(totals.entries.movements, totals.entries.units, "entrée de stock", "entrées de stock");
        add(totals.others.movements, totals.others.units, "autre mouvement", "autres mouvements");
        return lines;
    }

    confirm() {
        if (this.applying()) return;

        this.applying.set(true);
        this.error.set("");

        this.inventoryService.apply(this.inventory().id).subscribe({
            next: (result) => {
                this.applying.set(false);
                this.dialog().nativeElement.close();
                this.applied.emit(result);
            },
            error: (err: HttpErrorResponse) => {
                this.applying.set(false);
                this.error.set(err.error?.message ?? "Le stock n'a pas pu être corrigé.");
            },
        });
    }
}

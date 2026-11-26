import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { newRef } from "../../core/offline/new-ref";
import { InProgressConflict } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";

// Le comptage s'ouvre tout de suite, sans formulaire : on arrive directement sur l'écran de saisie.
// S'il y en a déjà un en cours, on le reprend.
@Component({
    selector: "app-new-inventory",
    imports: [PageHeader],
    templateUrl: "./new-inventory.html",
    styleUrl: "./new-inventory.css",
})
export class NewInventory {
    private inventoryService = inject(InventoryService);
    private router = inject(Router);

    // Créée une fois pour la page : un réessai ne crée pas deux inventaires
    private clientKey = newRef();

    error = signal("");

    constructor() {
        this.start();
    }

    start() {
        this.error.set("");

        this.inventoryService.start({ clientKey: this.clientKey }).subscribe({
            next: (inventory) => this.goToCount(inventory.id),
            error: (err: HttpErrorResponse) => {
                if (err.status === 409 && err.error?.code === "INVENTORY_IN_PROGRESS") {
                    this.goToCount((err.error as InProgressConflict).existing.id);
                    return;
                }

                this.error.set(err.error?.message ?? "Le comptage n'a pas pu être ouvert.");
            },
        });
    }

    private goToCount(id: number) {
        this.router.navigate(["/inventories", id, "count"], { replaceUrl: true });
    }
}

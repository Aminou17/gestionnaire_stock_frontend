import { Component, computed, input } from "@angular/core";

import { Inventory } from "../../core/stock/inventory.model";
import { STATUS_TONES } from "./inventory-look";

// Pastille du statut : En cours (bleu), À valider (orange), Terminé (vert), Annulé (gris)
@Component({
    selector: "app-inventory-status",
    template: `<span class="badge" [class]="'badge-' + tone()">{{
        inventory().statusLabel
    }}</span>`,
})
export class InventoryStatusBadge {
    inventory = input.required<Pick<Inventory, "status" | "statusLabel">>();

    protected tone = computed(() => STATUS_TONES[this.inventory().status]);
}

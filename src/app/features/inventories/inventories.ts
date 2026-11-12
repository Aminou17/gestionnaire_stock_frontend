import { DatePipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-inventories",
    imports: [RouterLink, DatePipe, PageHeader, Icon, FcfaPipe],
    templateUrl: "./inventories.html",
    styleUrl: "./inventories.css",
})
export class Inventories {
    private inventoryService = inject(InventoryService);
    private router = inject(Router);

    inventories = rxResource({
        stream: () => this.inventoryService.getInventories(),
    });

    openInventory(inventory: Inventory) {
        this.router.navigate(["/inventories", inventory.id]);
    }
}

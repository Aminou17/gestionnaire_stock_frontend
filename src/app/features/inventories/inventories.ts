import { DatePipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { ExportFormat } from "../../core/export-format";
import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Icon } from "../../shared/icon/icon";
import { Pagination, clientPaging } from "../../shared/pagination/pagination";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-inventories",
    imports: [RouterLink, DatePipe, PageHeader, Icon, EmptyState, ExportMenu, FcfaPipe, Pagination],
    templateUrl: "./inventories.html",
    styleUrl: "./inventories.css",
})
export class Inventories {
    private inventoryService = inject(InventoryService);
    private router = inject(Router);

    inventories = rxResource({
        stream: () => this.inventoryService.getInventories(),
    });

    paging = clientPaging(
        () => (this.inventories.hasValue() ? this.inventories.value() : []),
        "inventories",
    );

    private destroyRef = inject(DestroyRef);

    exporting = signal(false);
    exportError = signal(false);

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(false);

        this.inventoryService
            .exportFile(format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `inventaires.${format}`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url));
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set(true);
                },
            });
    }

    openInventory(inventory: Inventory) {
        this.router.navigate(["/inventories", inventory.id]);
    }
}

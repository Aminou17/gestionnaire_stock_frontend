import { NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ExportFormat } from "../../core/export-format";
import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { downloadFile } from "../../shared/download-file";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { Pagination } from "../../shared/pagination/pagination";
import { STATUS_ICONS, STATUS_TONES, inventoryTitle, listResult } from "./inventory-look";
import { InventoryStatusBadge } from "./inventory-status";

const PAGE_SIZE = 20;

// La liste a deux blocs : ce qu'il reste à faire (comptage en cours, à valider) puis l'historique.
// Les inventaires annulés ne sont pas affichés.
@Component({
    selector: "app-inventories",
    imports: [
        NgTemplateOutlet,
        RouterLink,
        PageHeader,
        ActionMenu,
        Icon,
        EmptyState,
        Pagination,
        LoadError,
        InventoryStatusBadge,
    ],
    templateUrl: "./inventories.html",
    styleUrl: "./inventories.css",
})
export class Inventories {
    private inventoryService = inject(InventoryService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    page = signal(1);
    pageSize = signal(PAGE_SIZE);

    todo = rxResource({
        stream: () =>
            this.inventoryService.getInventories({
                statuses: ["in_progress", "counted"],
                search: "",
                page: 1,
                limit: 20,
            }),
    });

    history = rxResource({
        params: () => ({ page: this.page() }),
        stream: ({ params }) =>
            this.inventoryService.getInventories({
                statuses: ["applied"],
                search: "",
                page: params.page,
                limit: PAGE_SIZE,
            }),
    });

    todoRows = computed(() => (this.todo.hasValue() ? this.todo.value().data : []));
    historyRows = computed(() => (this.history.hasValue() ? this.history.value().data : []));
    historyTotal = computed(() =>
        this.history.hasValue() ? this.history.value().pagination.total : 0,
    );

    // premier chargement : pas de liste à garder à l'écran
    firstLoad = computed(
        () =>
            (this.todo.isLoading() && !this.todo.hasValue()) ||
            (this.history.isLoading() && !this.history.hasValue()),
    );

    // l'export est réservé à l'admin
    menuItems: ActionItem[] = [
        { id: "pdf", label: "Exporter en PDF", icon: "download" },
        { id: "csv", label: "Exporter en CSV", icon: "download" },
    ];

    exporting = signal(false);
    exportError = signal(false);

    title = inventoryTitle;
    icon = (inventory: Inventory) => STATUS_ICONS[inventory.status];
    tone = (inventory: Inventory) => STATUS_TONES[inventory.status];
    result = (inventory: Inventory) => listResult(inventory, this.auth.isAdmin());

    // un comptage en cours s'ouvre directement sur la saisie, les autres sur leur fiche
    link(inventory: Inventory) {
        return inventory.status === "in_progress"
            ? ["/inventories", inventory.id, "count"]
            : ["/inventories", inventory.id];
    }

    reload() {
        this.todo.reload();
        this.history.reload();
    }

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(false);

        this.inventoryService
            .exportList(format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    downloadFile(file, `inventaires.${format}`);
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set(true);
                },
            });
    }
}

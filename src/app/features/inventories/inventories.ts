import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
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

    // Un comptage ouvert sans aucun produit n'a rien à montrer : on ne l'affiche pas
    todoRows = computed(() =>
        (this.todo.hasValue() ? this.todo.value().data : []).filter(
            (inventory) => inventory.status !== "in_progress" || inventory.itemsCount > 0,
        ),
    );
    historyRows = computed(() => (this.history.hasValue() ? this.history.value().data : []));
    historyTotal = computed(() =>
        this.history.hasValue() ? this.history.value().pagination.total : 0,
    );

    // Premier chargement : pas de liste à garder à l'écran
    firstLoad = computed(
        () =>
            (this.todo.isLoading() && !this.todo.hasValue()) ||
            (this.history.isLoading() && !this.history.hasValue()),
    );

    title = inventoryTitle;
    icon = (inventory: Inventory) => STATUS_ICONS[inventory.status];
    tone = (inventory: Inventory) => STATUS_TONES[inventory.status];
    result = (inventory: Inventory) => listResult(inventory, this.auth.isAdmin());

    // Un comptage en cours s'ouvre directement sur la saisie, les autres sur leur fiche
    link(inventory: Inventory) {
        return inventory.status === "in_progress"
            ? ["/inventories", inventory.id, "count"]
            : ["/inventories", inventory.id];
    }

    reload() {
        this.todo.reload();
        this.history.reload();
    }
}

import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { newRef } from "../../core/offline/new-ref";
import { InProgressConflict } from "../../core/stock/inventory.model";
import { CategoryService } from "../../core/stock/category.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { inventoryTitle } from "./inventory-look";

// Ouverture d'un comptage : un seul geste, le nom et la catégorie sont facultatifs
@Component({
    selector: "app-new-inventory",
    imports: [RouterLink, PageHeader, Icon, LoadError],
    templateUrl: "./new-inventory.html",
    styleUrl: "./new-inventory.css",
})
export class NewInventory {
    private inventoryService = inject(InventoryService);
    private categoryService = inject(CategoryService);
    private router = inject(Router);

    // créé une fois pour la page : un deuxième appui ou un réessai ne crée pas deux inventaires
    private clientKey = newRef();

    name = signal("");
    categoryId = signal<number | null>(null);
    optionsOpen = signal(false);
    saving = signal(false);
    error = signal("");

    // comptage déjà ouvert, connu à l'arrivée ou appris par la réponse 409
    private conflict = signal<InProgressConflict["existing"] | null>(null);

    categories = rxResource({ stream: () => this.categoryService.getCategories() });

    current = rxResource({
        stream: () =>
            this.inventoryService.getInventories({
                statuses: ["in_progress"],
                search: "",
                page: 1,
                limit: 1,
            }),
    });

    activeCategories = computed(() =>
        (this.categories.hasValue() ? this.categories.value() : []).filter((c) => c.is_active),
    );

    existing = computed(() => {
        const open = this.current.hasValue() ? this.current.value().data[0] : undefined;

        if (open) {
            return {
                id: open.id,
                title: inventoryTitle(open),
                progress: `${open.countedCount} sur ${open.itemsCount} produits comptés`,
            };
        }

        const conflict = this.conflict();
        return conflict
            ? { id: conflict.id, title: conflict.name || "Comptage en cours", progress: null }
            : null;
    });

    start() {
        if (this.saving()) return;

        this.saving.set(true);
        this.error.set("");

        const name = this.name().trim();
        const categoryId = this.categoryId();

        this.inventoryService
            .start({
                clientKey: this.clientKey,
                ...(name ? { name } : {}),
                ...(categoryId ? { categoryId } : {}),
            })
            .subscribe({
                next: (inventory) =>
                    this.router.navigate(["/inventories", inventory.id, "count"], {
                        replaceUrl: true,
                    }),
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);

                    if (err.status === 409 && err.error?.code === "INVENTORY_IN_PROGRESS") {
                        this.conflict.set((err.error as InProgressConflict).existing);
                        return;
                    }

                    this.error.set(err.error?.message ?? "Le comptage n'a pas pu être ouvert.");
                },
            });
    }
}

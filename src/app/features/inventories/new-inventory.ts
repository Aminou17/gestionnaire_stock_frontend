import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { CategoryService } from "../../core/stock/category.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { ProductService } from "../../core/stock/product.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { categoryTone, productInitials } from "../products/product-look";

// même limite que le backend
const MAX_STOCK = 1000000;

@Component({
    selector: "app-new-inventory",
    imports: [PageHeader, Icon],
    templateUrl: "./new-inventory.html",
    styleUrl: "./new-inventory.css",
})
export class NewInventory {
    private inventoryService = inject(InventoryService);
    private productService = inject(ProductService);
    private categoryService = inject(CategoryService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    search = signal("");
    categoryId = signal<number | null>(null);
    // quantités comptées par produit ; un produit absent n'est pas compté
    counts = signal<Record<number, number>>({});
    saving = signal(false);
    error = signal("");

    categories = rxResource({ stream: () => this.categoryService.getCategories() });

    products = rxResource({
        params: () => ({ categoryId: this.categoryId() }),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: "",
                categoryId: params.categoryId,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 500,
            }),
    });

    activeCategories = computed(() =>
        (this.categories.hasValue() ? this.categories.value() : []).filter((c) => c.is_active),
    );

    visible = computed(() => {
        if (!this.products.hasValue()) return [];
        const term = this.search().trim().toLowerCase();
        return this.products.value().data.filter((p) => p.name.toLowerCase().includes(term));
    });

    // l'API est interrogée avec une limite : on prévient si des produits n'ont pas été chargés
    truncated = computed(
        () =>
            this.products.hasValue() &&
            this.products.value().total > this.products.value().data.length,
    );

    initials = productInitials;
    tone = categoryTone;

    countedTotal = computed(() => Object.keys(this.counts()).length);

    // la jauge compte seulement les produits chargés (la catégorie choisie)
    totalProducts = computed(() =>
        this.products.hasValue() ? this.products.value().data.length : 0,
    );

    countedInList = computed(() => {
        if (!this.products.hasValue()) return 0;
        const counts = this.counts();
        return this.products.value().data.filter((p) => counts[p.id] !== undefined).length;
    });

    progressPercent = computed(() =>
        this.totalProducts() === 0 ? 0 : (this.countedInList() / this.totalProducts()) * 100,
    );

    selectCategory(value: string) {
        this.categoryId.set(value ? Number(value) : null);
    }

    setCount(productId: number, value: string) {
        const number = Math.floor(Number(value));
        if (value.trim() === "" || !Number.isFinite(number)) {
            this.counts.update(({ [productId]: _, ...rest }) => rest);
            return;
        }
        const count = Math.min(Math.max(number, 0), MAX_STOCK);
        this.counts.update((counts) => ({ ...counts, [productId]: count }));
    }

    // un produit pas encore compté commence à 0
    step(productId: number, delta: number) {
        const current = this.counts()[productId] ?? 0;
        const count = Math.min(Math.max(current + delta, 0), MAX_STOCK);
        this.counts.update((counts) => ({ ...counts, [productId]: count }));
    }

    // Entrée passe au produit suivant, pour compter sans toucher la souris
    focusNext(event: Event) {
        event.preventDefault();
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input.count-input"));
        const index = inputs.indexOf(event.target as HTMLInputElement);
        inputs[index + 1]?.focus();
    }

    save() {
        const items = Object.entries(this.counts()).map(([productId, actualStock]) => ({
            productId: Number(productId),
            actualStock,
        }));
        if (items.length === 0 || this.saving()) return;

        this.saving.set(true);
        this.error.set("");
        this.inventoryService
            .createInventory(items)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (inventory) => this.router.navigate(["/inventories", inventory.id]),
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(
                        err.error?.message ?? "L'inventaire n'a pas pu être enregistré.",
                    );
                },
            });
    }
}

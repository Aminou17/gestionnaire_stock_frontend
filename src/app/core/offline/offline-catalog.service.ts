import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { Category } from "../stock/category.model";
import { Product } from "../stock/product.model";
import { ProductService } from "../stock/product.service";
import { dbGet, dbSet } from "./local-db";

interface CatalogSnapshot {
    products: Product[];
    categories: Category[];
    savedAt: string;
}

const PAGE = 500;

// Catalogue gardé sur l'appareil pour vendre sans internet : produits actifs et catégories.
// Rechargé à l'ouverture de la vente quand le réseau est là ; le stock y baisse à chaque vente hors ligne.
@Injectable({ providedIn: "root" })
export class OfflineCatalogService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);
    private productService = inject(ProductService);

    readonly products = signal<Product[]>([]);
    readonly categories = signal<Category[]>([]);
    readonly savedAt = signal<string | null>(null);

    private loadedFor: number | null = null;
    private pendingLines: () => { productId: number; quantity: number }[] = () => [];

    // La file des ventes hors ligne dit ce qui n'est pas encore sorti du stock du serveur
    registerPending(lines: () => { productId: number; quantity: number }[]) {
        this.pendingLines = lines;
    }

    // Une clé par compte : deux vendeurs sur le même appareil ne mélangent pas leurs caisses
    private key() {
        return `catalog:${this.auth.user()?.id ?? 0}`;
    }

    async load() {
        const userId = this.auth.user()?.id ?? 0;
        if (this.loadedFor === userId) return;

        const snapshot = await dbGet<CatalogSnapshot>("kv", this.key());
        this.loadedFor = userId;
        if (!snapshot) return;

        this.products.set(snapshot.products);
        this.categories.set(snapshot.categories);
        this.savedAt.set(snapshot.savedAt);
    }

    // Tous les produits actifs, page par page, puis les catégories
    async refresh() {
        const products: Product[] = [];

        for (let page = 1; ; page++) {
            const result = await firstValueFrom(
                this.productService.getProducts({
                    search: "",
                    categoryId: null,
                    stockStatus: null,
                    status: "active",
                    page,
                    limit: PAGE,
                }),
            );
            products.push(...result.data);
            if (result.data.length < PAGE || products.length >= result.total) break;
        }

        const categories = await firstValueFrom(this.http.get<Category[]>(`${API_URL}/categories`));

        // Le serveur ne connaît pas encore les ventes en attente : on les retire du stock affiché
        const waiting = new Map<number, number>();
        for (const line of this.pendingLines()) {
            waiting.set(line.productId, (waiting.get(line.productId) ?? 0) + line.quantity);
        }

        this.products.set(
            products.map((product) =>
                waiting.has(product.id)
                    ? {
                          ...product,
                          theoretical_stock: product.theoretical_stock - waiting.get(product.id)!,
                      }
                    : product,
            ),
        );
        this.categories.set(categories);
        await this.save();
    }

    // Une vente faite sans internet fait baisser le stock affiché tout de suite
    async takeStock(lines: { productId: number; quantity: number }[]) {
        const sold = new Map(lines.map((line) => [line.productId, line.quantity]));
        this.products.update((products) =>
            products.map((product) =>
                sold.has(product.id)
                    ? {
                          ...product,
                          theoretical_stock: product.theoretical_stock - sold.get(product.id)!,
                      }
                    : product,
            ),
        );
        await this.save();
    }

    private async save() {
        const savedAt = new Date().toISOString();
        this.savedAt.set(savedAt);
        await dbSet("kv", this.key(), {
            products: this.products(),
            categories: this.categories(),
            savedAt,
        } satisfies CatalogSnapshot);
    }
}

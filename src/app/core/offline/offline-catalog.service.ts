import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { Category } from "../stock/category.model";
import { Product } from "../stock/product.model";
import { ProductService } from "../stock/product.service";
import { dbGet, dbSet } from "./local-db";

// état de la caisse du jour, gardé pour savoir sans internet si l'on peut vendre
export interface CachedCash {
    status: "OPEN" | "CLOSED" | null;
    sessionDate: string | null;
}

interface CatalogSnapshot {
    products: Product[];
    categories: Category[];
    cash: CachedCash | null;
    savedAt: string;
}

const PAGE = 500;

// Catalogue gardé sur l'appareil pour vendre sans internet : produits actifs, catégories et caisse.
// Rechargé à l'ouverture de la vente quand le réseau est là ; le stock y baisse à chaque vente hors ligne.
@Injectable({ providedIn: "root" })
export class OfflineCatalogService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);
    private productService = inject(ProductService);

    readonly products = signal<Product[]>([]);
    readonly categories = signal<Category[]>([]);
    readonly cash = signal<CachedCash | null>(null);
    readonly savedAt = signal<string | null>(null);

    private loadedFor: number | null = null;

    // une clé par compte : deux vendeurs sur le même appareil ne mélangent pas leurs caisses
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
        this.cash.set(snapshot.cash);
        this.savedAt.set(snapshot.savedAt);
    }

    // tous les produits actifs, page par page, puis les catégories
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

        this.products.set(products);
        this.categories.set(categories);
        await this.save();
    }

    async saveCash(cash: CachedCash | null) {
        this.cash.set(cash);
        await this.save();
    }

    // une vente faite sans internet fait baisser le stock affiché tout de suite
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
            cash: this.cash(),
            savedAt,
        } satisfies CatalogSnapshot);
    }
}

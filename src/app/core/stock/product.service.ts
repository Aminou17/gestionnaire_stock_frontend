import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { Product, ProductDetail, ProductFilters, ProductInput, ProductPage } from "./product.model";

// PostgreSQL renvoie les montants en texte ("1500.00")
const toProduct = <T extends Product>(product: T): T => ({
    ...product,
    purchase_price:
        product.purchase_price === undefined ? undefined : Number(product.purchase_price),
    sale_price: Number(product.sale_price),
    max_discount: Number(product.max_discount),
});

@Injectable({ providedIn: "root" })
export class ProductService {
    private http = inject(HttpClient);

    getProducts(filters: ProductFilters) {
        const params: Record<string, string | number> = {
            search: filters.search,
            page: filters.page,
            limit: filters.limit,
            includeSummary: "true",
        };

        if (filters.sort && filters.sort !== "default") params["sort"] = filters.sort;
        if (filters.categoryId) params["categoryId"] = filters.categoryId;
        if (filters.supplierId) params["supplierId"] = filters.supplierId;
        if (filters.stockStatus) params["stockStatus"] = filters.stockStatus;
        // Le backend refuse un autre statut que "active" à l'employé : on ne l'envoie qu'au besoin
        if (filters.status !== "active") params["status"] = filters.status;

        return this.http
            .get<ProductPage>(`${API_URL}/products`, { params })
            .pipe(map((res) => ({ ...res, data: res.data.map(toProduct) })));
    }

    getProduct(id: number) {
        return this.http
            .get<ProductDetail>(`${API_URL}/products/${id}`)
            .pipe(map((product) => toProduct(product)));
    }

    createProduct(input: ProductInput) {
        return this.http.post<ProductDetail>(`${API_URL}/products`, input);
    }

    updateProduct(id: number, input: Partial<ProductInput>) {
        return this.http.patch<ProductDetail>(`${API_URL}/products/${id}`, input);
    }

    deleteProduct(id: number) {
        return this.http.delete<{ message: string }>(`${API_URL}/products/${id}`);
    }

    // Image : data URL PNG ou JPEG, ou null pour retirer la photo
    // thumb : petite version pour la liste
    setImage(id: number, image: string | null, thumb: string | null = null) {
        return this.http.patch<{ id: number; image: string | null }>(
            `${API_URL}/products/${id}/image`,
            { image, thumb },
        );
    }
}

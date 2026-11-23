import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import {
    ApplyResult,
    CountLine,
    Inventory,
    InventoryDetail,
    InventoryFilters,
    InventoryList,
    ItemQuery,
    ItemReason,
    MovementsSince,
    NewInventory,
} from "./inventory.model";

@Injectable({ providedIn: "root" })
export class InventoryService {
    private http = inject(HttpClient);

    getInventories(filters: InventoryFilters) {
        const params: Record<string, string | number> = {
            page: filters.page,
            limit: filters.limit,
        };

        if (filters.statuses.length > 0) params["status"] = filters.statuses.join(",");
        if (filters.search) params["search"] = filters.search;

        return this.http.get<InventoryList>(`${API_URL}/inventories`, { params });
    }

    // l'inventaire et une page de ses lignes
    getInventory(id: number, query: ItemQuery) {
        const params: Record<string, string | number> = {
            filter: query.filter,
            page: query.page,
            limit: query.limit,
        };

        if (query.search) params["search"] = query.search;

        return this.http.get<InventoryDetail>(`${API_URL}/inventories/${id}`, { params });
    }

    // 201 à l'ouverture, 200 si la clientKey est déjà connue ; 409 si un comptage est déjà en cours
    start(body: NewInventory) {
        return this.http.post<Inventory>(`${API_URL}/inventories`, body);
    }

    saveItems(id: number, items: CountLine[]) {
        return this.http.put<{ saved: number; inventory: Inventory }>(
            `${API_URL}/inventories/${id}/items`,
            { items },
        );
    }

    // raison d'un écart (null l'efface), seulement quand le comptage est à valider
    setReason(id: number, productId: number, reason: ItemReason | null) {
        return this.http.put<{ productId: number; reason: ItemReason | null }>(
            `${API_URL}/inventories/${id}/items/${productId}/reason`,
            { reason },
        );
    }

    // retire un produit du comptage
    removeItem(id: number, productId: number) {
        return this.http.delete<{ inventory: Inventory }>(
            `${API_URL}/inventories/${id}/items/${productId}`,
        );
    }

    close(id: number) {
        return this.http.post<{ inventory: Inventory }>(`${API_URL}/inventories/${id}/close`, {});
    }

    apply(id: number) {
        return this.http.post<ApplyResult>(`${API_URL}/inventories/${id}/apply`, {});
    }

    cancel(id: number) {
        return this.http.post<{ inventory: Inventory }>(`${API_URL}/inventories/${id}/cancel`, {});
    }

    getMovementsSince(id: number) {
        return this.http.get<MovementsSince>(`${API_URL}/inventories/${id}/movements-since`);
    }

    // fichier de la liste des inventaires
    exportList(format: ExportFormat) {
        return this.http.get(`${API_URL}/inventories/export`, {
            params: { format },
            responseType: "blob",
        });
    }

    // fichier du détail d'un inventaire, une ligne par produit
    exportInventory(id: number, format: ExportFormat) {
        return this.http.get(`${API_URL}/inventories/${id}/export`, {
            params: { format },
            responseType: "blob",
        });
    }
}

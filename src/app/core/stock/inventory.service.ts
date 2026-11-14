import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import { Inventory, InventoryDetail, NewInventoryItem } from "./inventory.model";

@Injectable({ providedIn: "root" })
export class InventoryService {
    private http = inject(HttpClient);

    getInventories() {
        // difference_value est un BIGINT : PostgreSQL le renvoie en texte
        return this.http.get<Inventory[]>(`${API_URL}/inventories`).pipe(
            map((inventories) =>
                inventories.map((inventory) => ({
                    ...inventory,
                    difference_value: Number(inventory.difference_value),
                })),
            ),
        );
    }

    // fichier de la liste des inventaires
    exportFile(format: ExportFormat) {
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

    createInventory(items: NewInventoryItem[]) {
        return this.http.post<{ id: number }>(`${API_URL}/inventories`, { items });
    }

    applyInventory(id: number) {
        return this.http.post<{ id: number; applied_at: string; adjustments: number }>(
            `${API_URL}/inventories/${id}/apply`,
            {},
        );
    }

    getInventory(id: number) {
        // PostgreSQL renvoie les prix en texte ("2500.00")
        return this.http.get<InventoryDetail>(`${API_URL}/inventories/${id}`).pipe(
            map((inventory) => ({
                ...inventory,
                difference_value: Number(inventory.difference_value),
                items: inventory.items.map((item) => ({
                    ...item,
                    purchase_price: Number(item.purchase_price),
                })),
            })),
        );
    }
}

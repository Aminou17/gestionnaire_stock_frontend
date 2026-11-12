import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { Inventory, InventoryDetail, NewInventoryItem } from "./inventory.model";

@Injectable({ providedIn: "root" })
export class InventoryService {
    private http = inject(HttpClient);

    getInventories() {
        return this.http.get<Inventory[]>(`${API_URL}/inventories`);
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
                items: inventory.items.map((item) => ({
                    ...item,
                    purchase_price: Number(item.purchase_price),
                })),
            })),
        );
    }
}

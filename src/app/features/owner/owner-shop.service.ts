import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../core/api.config";
import { CreatedShop, NewShopInput, OwnedShop, ShopStatus } from "./owned-shop.model";

@Injectable({ providedIn: "root" })
export class OwnerShopService {
    private http = inject(HttpClient);

    getShops() {
        return this.http.get<OwnedShop[]>(`${API_URL}/shops`);
    }

    createShop(input: NewShopInput) {
        return this.http.post<CreatedShop>(`${API_URL}/shops`, input);
    }

    setStatus(id: number, status: ShopStatus) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/status`, { status });
    }
}

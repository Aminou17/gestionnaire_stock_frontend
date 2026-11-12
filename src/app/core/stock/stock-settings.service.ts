import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";

export interface StockSettings {
    id: number;
    min_stock: number;
}

@Injectable({ providedIn: "root" })
export class StockSettingsService {
    private http = inject(HttpClient);

    getSettings() {
        return this.http.get<StockSettings | null>(`${API_URL}/stock-settings`);
    }

    updateSettings(minStock: number) {
        return this.http.put<StockSettings>(`${API_URL}/stock-settings`, { minStock });
    }
}

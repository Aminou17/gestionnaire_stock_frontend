import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { StockMovementFilters, StockMovementPage } from "./stock-movement.model";

// Historique en lecture seule : les mouvements naissent des entrées, ventes et remboursements
@Injectable({ providedIn: "root" })
export class StockMovementService {
    private http = inject(HttpClient);

    getMovements(filters: StockMovementFilters) {
        const params = {
            ...this.filterParams(filters),
            page: filters.page,
            limit: filters.limit,
            includeSummary: "true",
        };

        return this.http.get<StockMovementPage>(`${API_URL}/stock_movements`, { params });
    }

    // fichier CSV des mouvements correspondant aux filtres, sans pagination
    exportCsv(filters: Omit<StockMovementFilters, "page" | "limit">) {
        return this.http.get(`${API_URL}/stock_movements/export`, {
            params: this.filterParams(filters),
            responseType: "blob",
        });
    }

    private filterParams(filters: Omit<StockMovementFilters, "page" | "limit">) {
        const params: Record<string, string | number> = {};

        if (filters.from) params["startDate"] = filters.from;
        if (filters.to) params["endDate"] = filters.to;
        if (filters.type) params["type"] = filters.type;
        if (filters.productId) params["productId"] = filters.productId;

        return params;
    }
}

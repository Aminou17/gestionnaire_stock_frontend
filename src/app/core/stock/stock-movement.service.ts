import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import {
    StockAdjustmentInput,
    StockMovementFilters,
    StockMovementPage,
} from "./stock-movement.model";

// Historique des mouvements : ils naissent des entrées, ventes, remboursements et ajustements
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

    // ajustement manuel du stock, réservé à l'admin
    adjustStock(input: StockAdjustmentInput) {
        return this.http.post<{ id: number; stock_after: number }>(
            `${API_URL}/stock_movements/adjustments`,
            input,
        );
    }

    // fichier des mouvements correspondant aux filtres, sans pagination
    exportFile(filters: Omit<StockMovementFilters, "page" | "limit">, format: ExportFormat) {
        return this.http.get(`${API_URL}/stock_movements/export`, {
            params: { ...this.filterParams(filters), format },
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

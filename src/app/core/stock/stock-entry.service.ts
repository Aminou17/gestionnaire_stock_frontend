import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { StockEntryFilters, StockEntryInput, StockEntryPage } from "./stock-entry.model";

// Entrées de stock : réservées au propriétaire, côté backend comme côté interface
@Injectable({ providedIn: "root" })
export class StockEntryService {
    private http = inject(HttpClient);

    getEntries(filters: StockEntryFilters) {
        const params: Record<string, string | number> = {
            page: filters.page,
            limit: filters.limit,
            includeSummary: "true",
        };

        if (filters.from) params["from"] = filters.from;
        if (filters.to) params["to"] = filters.to;
        if (filters.supplierId) params["supplierId"] = filters.supplierId;

        return this.http.get<StockEntryPage>(`${API_URL}/stock_entries`, { params });
    }

    createEntry(input: StockEntryInput) {
        return this.http.post<{ id: number }>(`${API_URL}/stock_entries`, input);
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../../core/api.config";
import { ExportFormat } from "../../../core/export-format";

@Injectable({ providedIn: "root" })
export class ExportService {
    private http = inject(HttpClient);

    productsFile(format: ExportFormat) {
        return this.http.get(`${API_URL}/exports/products`, {
            params: { format },
            responseType: "blob",
        });
    }

    // from et to : YYYY-MM-DD, sans borne toutes les ventes sont exportées
    salesFile(from: string | null, to: string | null, format: ExportFormat) {
        const params: Record<string, string> = { format };

        if (from) params["startDate"] = from;
        if (to) params["endDate"] = to;

        return this.http.get(`${API_URL}/exports/sales`, { params, responseType: "blob" });
    }
}

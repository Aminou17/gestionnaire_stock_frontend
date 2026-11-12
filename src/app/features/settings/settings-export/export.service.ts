import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../../core/api.config";

@Injectable({ providedIn: "root" })
export class ExportService {
    private http = inject(HttpClient);

    productsCsv() {
        return this.http.get(`${API_URL}/exports/products`, { responseType: "blob" });
    }

    // from et to : YYYY-MM-DD, sans borne toutes les ventes sont exportées
    salesCsv(from: string | null, to: string | null) {
        const params: Record<string, string> = {};

        if (from) params["startDate"] = from;
        if (to) params["endDate"] = to;

        return this.http.get(`${API_URL}/exports/sales`, { params, responseType: "blob" });
    }
}

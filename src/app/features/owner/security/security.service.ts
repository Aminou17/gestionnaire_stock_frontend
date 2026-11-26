import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../../core/api.config";
import { Page, SecurityFilters, SecurityOverview } from "./security.model";

// Routes /security : réservées au propriétaire, toutes boutiques confondues
@Injectable({ providedIn: "root" })
export class SecurityService {
    private http = inject(HttpClient);

    getOverview() {
        return this.http.get<SecurityOverview>(`${API_URL}/security/overview`);
    }

    // Une page d'une liste (failed-logins, locked-accounts ou events)
    getList<T>(path: string, query: ListQuery) {
        return this.http.get<Page<T>>(`${API_URL}/security/${path}`, {
            params: this.toParams(query),
        });
    }

    // Même liste en fichier CSV, avec les filtres affichés
    getCsv(path: string, query: ListQuery) {
        return this.http.get(`${API_URL}/security/${path}`, {
            params: this.toParams({ ...query, format: "csv" }),
            responseType: "blob",
        });
    }

    private toParams(query: ListQuery) {
        const { filters, extra = {}, page, limit, format } = query;
        const values: Record<string, string | number | null | undefined> = {
            ...extra,
            shopId: filters.shopId,
            email: filters.email,
            ip: filters.ip,
            startDate: filters.from,
            endDate: filters.to,
            page,
            limit,
            format,
        };

        // Un filtre vide ne part pas dans l'adresse
        let params = new HttpParams();
        for (const [key, value] of Object.entries(values)) {
            if (value !== null && value !== undefined && value !== "") {
                params = params.set(key, value);
            }
        }
        return params;
    }
}

export interface ListQuery {
    filters: SecurityFilters;
    // Paramètres propres à la liste (view, type)
    extra?: Record<string, string>;
    page?: number;
    limit?: number;
    format?: "csv";
}

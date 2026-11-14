import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { AuditLogFilters, AuditLogPage } from "./audit-log.model";

// Journal en lecture seule, réservé à l'administrateur
@Injectable({ providedIn: "root" })
export class AuditLogService {
    private http = inject(HttpClient);

    getLogs(filters: AuditLogFilters) {
        const params: Record<string, string | number> = {
            page: filters.page,
            limit: filters.limit,
        };

        if (filters.from) params["startDate"] = filters.from;
        if (filters.to) params["endDate"] = filters.to;
        if (filters.userId) params["userId"] = filters.userId;
        if (filters.action) params["action"] = filters.action;
        if (filters.result) params["result"] = filters.result;
        if (filters.category) params["category"] = filters.category;

        return this.http.get<AuditLogPage>(`${API_URL}/audit-logs`, { params });
    }
}

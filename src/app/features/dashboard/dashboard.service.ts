import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../../core/api.config";
import { Activity, DailySales, DashboardSummary } from "./dashboard.model";

@Injectable({ providedIn: "root" })
export class DashboardService {
    private http = inject(HttpClient);

    getSummary() {
        return this.http.get<DashboardSummary>(`${API_URL}/dashboard/summary`);
    }

    // Sans dates, le backend renvoie les 30 derniers jours selon SA date du jour :
    // on évite ainsi un décalage si l'horloge du navigateur et celle du serveur diffèrent.
    getDailySales() {
        return this.http
            .get<{ data: DailySales[] }>(`${API_URL}/dashboard/daily-sales`)
            .pipe(map((res) => res.data));
    }

    getRecentActivity(limit = 5) {
        return this.http
            .get<{ data: Activity[] }>(`${API_URL}/dashboard/recent-activity`, {
                params: { limit },
            })
            .pipe(map((res) => res.data));
    }
}

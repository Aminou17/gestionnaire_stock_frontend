import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../../core/api.config";
import { Activity, DailySales, DashboardSummary, SalesComparison } from "./dashboard.model";

@Injectable({ providedIn: "root" })
export class DashboardService {
    private http = inject(HttpClient);

    getSummary() {
        return this.http.get<DashboardSummary>(`${API_URL}/dashboard/summary`);
    }

    // Sans dates, le backend renvoie les 30 derniers jours selon SA date du jour :
    // on évite ainsi un décalage si l'horloge du navigateur et celle du serveur diffèrent.
    // mine : seulement mes ventes (le manager n'a que celles-là de toute façon)
    getDailySales(mine = false) {
        const params: Record<string, string> = mine ? { scope: "mine" } : {};

        return this.http
            .get<{ data: DailySales[] }>(`${API_URL}/dashboard/daily-sales`, { params })
            .pipe(map((res) => res.data));
    }

    getSalesComparison() {
        return this.http.get<SalesComparison>(`${API_URL}/dashboard/sales-comparison`);
    }

    // les ventes ont déjà leur propre liste sur le tableau de bord : on ne les répète pas dans l'activité
    getRecentActivity(limit = 5) {
        return this.http
            .get<{ data: Activity[] }>(`${API_URL}/dashboard/recent-activity`, {
                params: { limit, excludeSales: true },
            })
            .pipe(map((res) => res.data));
    }
}

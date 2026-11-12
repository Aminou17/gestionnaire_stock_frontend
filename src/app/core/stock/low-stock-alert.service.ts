import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { LowStockAlert } from "./low-stock-alert.model";

// Partagé par la sidebar (badge), la cloche et le tableau de bord : une seule requête.
@Injectable({ providedIn: "root" })
export class LowStockAlertService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);

    // route réservée à l'admin : rien n'est chargé pour le manager
    alerts = rxResource({
        params: () => (this.auth.isAdmin() ? this.auth.user()?.id : undefined),
        stream: () => this.http.get<LowStockAlert[]>(`${API_URL}/low-stock-alerts`),
    });

    count = computed(() => (this.alerts.hasValue() ? this.alerts.value().length : 0));

    failed = computed(() => this.alerts.error() !== undefined);
    loading = computed(() => this.alerts.isLoading() && !this.alerts.hasValue());

    reload() {
        this.alerts.reload();
    }
}

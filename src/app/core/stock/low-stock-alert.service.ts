import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import { AuthService } from "../auth/auth.service";
import { LowStockAlert, ProductRotation, SnoozeDays, SnoozedAlert } from "./low-stock-alert.model";

// Partagé par la sidebar (badge), la cloche et le tableau de bord : une seule requête.
@Injectable({ providedIn: "root" })
export class LowStockAlertService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);

    // le manager lit les alertes ; seul l'admin règle les seuils et les sourdines
    alerts = rxResource({
        params: () => this.auth.user()?.id,
        stream: () => this.http.get<LowStockAlert[]>(`${API_URL}/low-stock-alerts`),
    });

    // seul l'administrateur gère la sourdine
    snoozed = rxResource({
        params: () => (this.auth.isAdmin() ? this.auth.user()?.id : undefined),
        stream: () => this.http.get<SnoozedAlert[]>(`${API_URL}/low-stock-alerts/snoozed`),
    });

    snoozedList = computed(() => (this.snoozed.hasValue() ? this.snoozed.value() : []));

    getRotation() {
        return this.http.get<ProductRotation[]>(`${API_URL}/low-stock-alerts/rotation`);
    }

    // réservé à l'administrateur
    getPurchaseOrder(supplierId: number, format: ExportFormat = "pdf") {
        return this.http.get(`${API_URL}/low-stock-alerts/purchase-order/${supplierId}`, {
            params: { format },
            responseType: "blob",
        });
    }

    // days = null remet l'alerte en service
    snooze(productId: number, days: SnoozeDays | null) {
        return this.http.patch(`${API_URL}/low-stock-alerts/${productId}/snooze`, { days });
    }

    count = computed(() => (this.alerts.hasValue() ? this.alerts.value().length : 0));

    failed = computed(() => this.alerts.error() !== undefined);
    loading = computed(() => this.alerts.isLoading() && !this.alerts.hasValue());

    reload() {
        this.alerts.reload();
        this.snoozed.reload();
    }
}

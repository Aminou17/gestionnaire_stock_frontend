import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";

type View = "all" | "out" | "low";

// Page réservée au propriétaire (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-alerts",
    imports: [RouterLink, PageHeader, Icon],
    templateUrl: "./alerts.html",
    styleUrl: "./alerts.css",
})
export class Alerts {
    private alertService = inject(LowStockAlertService);

    // même requête que la cloche et la sidebar
    alerts = this.alertService.alerts;
    all = computed(() => (this.alerts.hasValue() ? this.alerts.value() : []));

    view = signal<View>("all");

    outCount = computed(() => this.all().filter((a) => this.isOut(a.theoretical_stock)).length);
    lowCount = computed(() => this.all().length - this.outCount());

    list = computed(() => {
        const view = this.view();
        if (view === "all") return this.all();
        return this.all().filter((a) => a.theoretical_stock <= 0 === (view === "out"));
    });

    private error = computed(() => this.alerts.error() as HttpErrorResponse | undefined);

    // le backend répond 409 tant que le seuil général n'est pas réglé
    needsSettings = computed(() => this.error()?.status === 409);

    errorMessage = computed(
        () => this.error()?.error?.message ?? "Impossible de charger les alertes.",
    );

    isOut(stock: number) {
        return stock <= 0;
    }
}

import { Component, computed, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { LowStockAlert } from "../../../core/stock/low-stock-alert.model";

@Component({
    selector: "app-stock-alerts",
    imports: [RouterLink],
    templateUrl: "./stock-alerts.html",
    styleUrl: "./stock-alerts.css",
})
export class StockAlerts {
    alerts = input<LowStockAlert[]>([]);
    loading = input(false);
    error = input(false);
    // la page des alertes est réservée à l'admin : l'employé est envoyé vers les produits
    link = input("/alerts");
    retry = output();

    // les plus urgents d'abord (déjà triés par le backend)
    visible = computed(() => this.alerts().slice(0, 5));

    // un stock théorique négatif s'affiche comme 0
    stock(alert: LowStockAlert) {
        return Math.max(alert.theoretical_stock, 0);
    }
}

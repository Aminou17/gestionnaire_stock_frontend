import { DecimalPipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { OwnerShopService } from "../owner-shop.service";

const PERIODS = [
    { days: 7, label: "7 jours" },
    { days: 30, label: "30 jours" },
    { days: 90, label: "90 jours" },
];

// Pourcentages de la marge proposés comme repères de tarif
const RATES = [1, 2, 3, 5];

const median = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Marge de chaque boutique : de quoi se faire une idée d'un tarif que les commerces peuvent accepter
@Component({
    selector: "app-margins-panel",
    imports: [DecimalPipe, FcfaPipe, RouterLink],
    templateUrl: "./margins-panel.html",
    styleUrl: "./margins-panel.css",
})
export class MarginsPanel {
    private owner = inject(OwnerShopService);

    protected periods = PERIODS;
    days = signal(30);

    report = rxResource({
        params: () => this.days(),
        stream: ({ params }) => this.owner.getMargins(params),
    });

    // Seulement les boutiques qui ont vendu sur la période
    rows = computed(() =>
        this.report.hasValue() ? this.report.value().rows.filter((row) => row.sales_count > 0) : [],
    );

    // Marge d'un mois pour la boutique du milieu : une période de 7 ou 90 jours est ramenée à 30 jours
    monthlyMedian = computed(() => {
        const margins = this.rows()
            .map((row) => row.margin)
            .filter((margin) => margin > 0);
        return Math.round((median(margins) * 30) / this.days());
    });

    // 1 %, 2 %... de cette marge, arrondis à 100 F
    hints = computed(() =>
        RATES.map((rate) => ({
            rate,
            amount: Math.round((this.monthlyMedian() * rate) / 100 / 100) * 100,
        })),
    );

    select(days: number) {
        this.days.set(days);
    }
}

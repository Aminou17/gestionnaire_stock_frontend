import { DatePipe } from "@angular/common";
import { Component, computed, input, output, signal } from "@angular/core";

import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { DailySales } from "../dashboard.model";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

@Component({
    selector: "app-sales-chart",
    imports: [DatePipe, FcfaPipe],
    templateUrl: "./sales-chart.html",
    styleUrl: "./sales-chart.css",
})
export class SalesChart {
    // le gérant voit "Mes ventes sur 7 jours"
    title = input("Ventes des 7 derniers jours");
    days = input<DailySales[]>([]);
    loading = input(false);
    error = input(false);
    retry = output();

    hovered = signal<number | null>(null);

    total = computed(() => this.days().reduce((sum, day) => sum + day.netTotal, 0));
    isEmpty = computed(() =>
        this.days().every((day) => day.salesCount === 0 && day.cancellationsCount === 0),
    );

    bars = computed(() => {
        const days = this.days();
        const max = Math.max(...days.map((d) => d.netTotal), 1);

        return days.map((day, i) => {
            const [y, m, d] = day.date.split("-").map(Number);
            const isToday = i === days.length - 1;
            return {
                ...day,
                label: isToday ? "Auj." : DAY_LABELS[new Date(y, m - 1, d).getDay()],
                fullDate: new Date(y, m - 1, d),
                isToday,
                height: Math.max((Math.max(day.netTotal, 0) / max) * 100, day.netTotal > 0 ? 2 : 0),
                short: shortAmount(day.netTotal),
            };
        });
    });
}

// 198500 -> "198,5k", 246000 -> "246k" : on garde une décimale pour ne pas arrondir de façon trompeuse
function shortAmount(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${compact(value / 1_000_000)}M`;
    if (abs >= 1000) return `${compact(value / 1000)}k`;
    return String(value);
}

function compact(value: number) {
    return value.toFixed(1).replace(/\.0$/, "").replace(".", ",");
}

import { Component, computed, output, signal } from "@angular/core";

import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// billets et pièces en F CFA
const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 250, 100, 50, 25, 10, 5];

// Aide au comptage du tiroir : on tape le nombre de billets et de pièces, le total est calculé
@Component({
    selector: "app-cash-counter",
    imports: [FcfaPipe, Icon],
    templateUrl: "./cash-counter.html",
    styleUrl: "./cash-counter.css",
})
export class CashCounter {
    protected denominations = DENOMINATIONS;

    // le total change à chaque saisie
    totalChange = output<number>();

    // replié par défaut ; les quantités restent quand on le referme
    open = signal(false);
    counts = signal<Record<number, number>>({});
    total = computed(() =>
        DENOMINATIONS.reduce((sum, value) => sum + value * (this.counts()[value] ?? 0), 0),
    );

    count(value: number) {
        return this.counts()[value] ?? 0;
    }

    set(value: number, raw: string) {
        const quantity = Math.max(0, Math.floor(Number(raw) || 0));
        this.counts.update((counts) => ({ ...counts, [value]: quantity }));
        this.totalChange.emit(this.total());
    }

    reset() {
        this.counts.set({});
        this.open.set(false);
    }
}

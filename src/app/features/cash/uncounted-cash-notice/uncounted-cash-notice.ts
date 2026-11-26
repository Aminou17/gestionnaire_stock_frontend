import { Component, computed, input, output } from "@angular/core";

import { UncountedSession } from "../../../core/cash/cash.model";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Petit rappel : une caisse d'un jour passé n'a pas été comptée. Elle ne bloque rien.
@Component({
    selector: "app-uncounted-cash-notice",
    imports: [Icon],
    templateUrl: "./uncounted-cash-notice.html",
    styleUrl: "./uncounted-cash-notice.css",
})
export class UncountedCashNotice {
    private fcfa = new FcfaPipe();

    session = input.required<UncountedSession>();

    count = output();

    // "d'hier", ou "du 12 novembre" pour une date plus ancienne
    when = computed(() => {
        const day = new Date(this.session().sessionDate + "T12:00:00");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (day.toDateString() === yesterday.toDateString()) return "d'hier";

        const label = day.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        return `du ${label}`;
    });

    // Ligne du dessous : combien on attend, et s'il en reste d'autres
    details = computed(() => {
        const session = this.session();
        const parts: string[] = [];

        if (session.balance !== null) parts.push(`Attendu ${this.fcfa.transform(session.balance)}`);
        if (session.count > 1)
            parts.push(`${session.count - 1} autre${session.count > 2 ? "s" : ""}`);

        return parts.join(" · ");
    });
}

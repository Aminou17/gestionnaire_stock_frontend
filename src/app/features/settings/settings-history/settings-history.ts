import { DatePipe } from "@angular/common";
import { Component, inject, input } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { SettingsHistoryService } from "./settings-history.service";

@Component({
    selector: "app-settings-history",
    imports: [DatePipe],
    templateUrl: "./settings-history.html",
    styleUrl: "./settings-history.css",
})
export class SettingsHistory {
    private historyService = inject(SettingsHistoryService);

    // actions du journal d'audit qui modifient ce réglage
    actions = input.required<string[]>();

    // la page l'augmente après chaque enregistrement pour relire la dernière modification
    version = input(0);

    change = rxResource({
        params: () => ({ actions: this.actions(), version: this.version() }),
        stream: ({ params }) => this.historyService.getLastChange(params.actions),
    });
}

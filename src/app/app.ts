import { DOCUMENT } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { guardNumberInputs } from "./core/number-inputs";
import { AppUpdateService } from "./core/pwa/app-update.service";
import { ThemeService } from "./core/theme/theme.service";
import { PageViewService } from "./core/usage/page-view.service";

@Component({
    selector: "app-root",
    imports: [RouterOutlet],
    templateUrl: "./app.html",
    styleUrl: "./app.css",
})
export class App {
    // Applique le thème enregistré dès le démarrage
    private theme = inject(ThemeService);

    constructor() {
        guardNumberInputs(inject(DOCUMENT));
        // Une nouvelle version mise en ligne s'affiche sans avoir à vider le cache
        inject(AppUpdateService).start();
        // Pages ouvertes par la boutique, comptées pour le propriétaire du logiciel
        inject(PageViewService).start();
    }
}

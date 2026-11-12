import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { ThemeService } from "./core/theme/theme.service";

@Component({
    selector: "app-root",
    imports: [RouterOutlet],
    templateUrl: "./app.html",
    styleUrl: "./app.css",
})
export class App {
    // applique le thème enregistré dès le démarrage
    private theme = inject(ThemeService);
}

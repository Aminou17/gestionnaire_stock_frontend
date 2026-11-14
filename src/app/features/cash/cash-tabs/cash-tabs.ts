import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";

// Les trois vues de la caisse, côte à côte : aujourd'hui, mouvements (admin), historique
@Component({
    selector: "app-cash-tabs",
    imports: [RouterLink, RouterLinkActive],
    templateUrl: "./cash-tabs.html",
    styleUrl: "./cash-tabs.css",
})
export class CashTabs {
    protected auth = inject(AuthService);
}

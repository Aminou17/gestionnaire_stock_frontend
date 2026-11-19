import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { Icon } from "../../shared/icon/icon";
import { LayoutService } from "../layout.service";

// Barre de navigation du bas, visible seulement sur téléphone
@Component({
    selector: "app-bottom-nav",
    imports: [RouterLink, RouterLinkActive, Icon],
    templateUrl: "./bottom-nav.html",
    styleUrl: "./bottom-nav.css",
})
export class BottomNav {
    protected layout = inject(LayoutService);

    // "Vendre" est au milieu : c'est l'action la plus fréquente
    left = [
        { label: "Accueil", path: "/dashboard", icon: "dashboard" },
        { label: "Produits", path: "/products", icon: "box" },
    ] as const;
    right = [{ label: "Caisse", path: "/cash", icon: "banknote" }] as const;
}

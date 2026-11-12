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

    links = [
        { label: "Accueil", path: "/dashboard", icon: "dashboard" },
        { label: "Ventes", path: "/sales", icon: "cart" },
        { label: "Produits", path: "/products", icon: "box" },
        { label: "Caisse", path: "/cash", icon: "banknote" },
    ] as const;
}

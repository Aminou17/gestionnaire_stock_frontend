import { Component, DestroyRef, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { PRODUCT_NAME } from "../../../core/brand";
import { AuthService } from "../../../core/auth/auth.service";
import { SupportService } from "../../../core/support/support.service";
import { ThemeService } from "../../../core/theme/theme.service";
import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";
import { LogoutDialog } from "../../../shared/logout-dialog/logout-dialog";

interface OwnerLink {
    path: string;
    label: string;
    icon: IconName;
    // seule la page d'accueil doit être exacte, sinon elle resterait allumée partout
    exact?: boolean;
}

// Le propriétaire n'a pas de boutique : ni menu de la caisse, ni alertes de stock.
// Une coque avec cinq entrées : menu latéral sur ordinateur, barre du bas sur téléphone
@Component({
    selector: "app-owner-layout",
    imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, LogoutDialog],
    templateUrl: "./owner-layout.html",
    styleUrl: "./owner-layout.css",
})
export class OwnerLayout {
    protected auth = inject(AuthService);
    protected theme = inject(ThemeService);
    protected support = inject(SupportService);
    protected productName = PRODUCT_NAME;

    protected links: OwnerLink[] = [
        { path: "/owner", label: "Accueil", icon: "dashboard", exact: true },
        { path: "/owner/shops", label: "Boutiques", icon: "store" },
        { path: "/owner/support", label: "Messages", icon: "message" },
        { path: "/owner/security", label: "Sécurité", icon: "shield" },
        { path: "/owner/settings", label: "Réglages", icon: "settings" },
    ];

    constructor() {
        // les nouveaux messages des boutiques apparaissent sans recharger la page
        const refresh = () => this.support.refreshUnread("owner");
        refresh();

        const timer = setInterval(refresh, 60_000);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
}

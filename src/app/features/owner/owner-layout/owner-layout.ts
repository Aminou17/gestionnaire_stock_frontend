import { Component, DestroyRef, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { PRODUCT_NAME } from "../../../core/brand";
import { AuthService } from "../../../core/auth/auth.service";
import { SupportService } from "../../../core/support/support.service";
import { ThemeService } from "../../../core/theme/theme.service";
import { Icon } from "../../../shared/icon/icon";
import { LogoutDialog } from "../../../shared/logout-dialog/logout-dialog";

// Le propriétaire n'a pas de boutique : ni menu de la caisse, ni alertes de stock,
// seulement sa barre, la page des boutiques et son mot de passe
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

    constructor() {
        // les nouveaux messages des boutiques apparaissent sans recharger la page
        const refresh = () => this.support.refreshUnread("owner");
        refresh();

        const timer = setInterval(refresh, 60_000);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
}

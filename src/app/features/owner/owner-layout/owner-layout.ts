import { Component, inject } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { ThemeService } from "../../../core/theme/theme.service";
import { Icon } from "../../../shared/icon/icon";

// Le propriétaire n'a pas de boutique : ni menu de la caisse, ni alertes de stock,
// seulement sa barre, la page des boutiques et son mot de passe
@Component({
    selector: "app-owner-layout",
    imports: [RouterOutlet, RouterLink, Icon],
    templateUrl: "./owner-layout.html",
    styleUrl: "./owner-layout.css",
})
export class OwnerLayout {
    protected auth = inject(AuthService);
    protected theme = inject(ThemeService);
}

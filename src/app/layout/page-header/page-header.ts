import { Component, inject, input } from "@angular/core";
import { RouterLink, UrlTree } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { Avatar } from "../../shared/avatar/avatar";
import { BackLink } from "../../shared/back-link/back-link";
import { Icon } from "../../shared/icon/icon";
import { LayoutService } from "../layout.service";
import { Notifications } from "../notifications/notifications";

@Component({
    selector: "app-page-header",
    imports: [RouterLink, BackLink, Avatar, Icon, Notifications],
    templateUrl: "./page-header.html",
    styleUrl: "./page-header.css",
})
export class PageHeader {
    protected auth = inject(AuthService);
    protected layout = inject(LayoutService);

    title = input.required<string>();
    subtitle = input<string>();
    // Rubrique du menu affichée au-dessus du titre (ex. "Stock")
    section = input<string>();
    // Lien de la flèche retour affichée à côté du titre (ex. "/categories")
    back = input<string | UrlTree>();
    backLabel = input("Retour");
    // Accueil : la cloche et le profil restent visibles sur téléphone, ailleurs la page se concentre sur son action
    home = input(false);
}

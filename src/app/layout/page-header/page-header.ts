import { Component, inject, input } from "@angular/core";
import { Router, RouterLink, UrlTree } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { Avatar } from "../../shared/avatar/avatar";
import { BackLink } from "../../shared/back-link/back-link";
import { Icon } from "../../shared/icon/icon";
import { LayoutService } from "../layout.service";
import { MessageButton } from "../message-button/message-button";
import { Notifications } from "../notifications/notifications";

@Component({
    selector: "app-page-header",
    imports: [RouterLink, BackLink, Avatar, Icon, Notifications, MessageButton],
    templateUrl: "./page-header.html",
    styleUrl: "./page-header.css",
})
export class PageHeader {
    protected auth = inject(AuthService);
    protected layout = inject(LayoutService);
    // L'icône ne sert à rien quand on est déjà dans les messages
    protected inMessages = /^\/(messages|support)\b/.test(inject(Router).url);

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

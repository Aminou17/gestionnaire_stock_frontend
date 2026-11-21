import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { ThemeService } from "../../../core/theme/theme.service";
import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";

interface SettingsLink {
    path: string;
    icon: IconName;
    title: string;
    text: string;
}

// Page d'entrée des réglages : une carte par sous-page, puis l'apparence et la déconnexion
// (sur téléphone, c'est le seul endroit où ils se trouvent)
@Component({
    selector: "app-owner-settings",
    imports: [RouterLink, Icon],
    templateUrl: "./settings-hub.html",
    styleUrl: "./settings-hub.css",
})
export class OwnerSettings {
    protected auth = inject(AuthService);
    protected theme = inject(ThemeService);

    protected links: SettingsLink[] = [
        {
            path: "/owner/settings/account",
            icon: "key",
            title: "Mot de passe et double authentification",
            text: "Changer votre mot de passe, activer le code de sécurité.",
        },
        {
            path: "/owner/settings/mail",
            icon: "mail",
            title: "E-mails d'envoi",
            text: "L'adresse qui envoie les liens de mot de passe oublié.",
        },
    ];
}

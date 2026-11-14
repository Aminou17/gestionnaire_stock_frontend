import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { Avatar } from "../../shared/avatar/avatar";
import { IconName } from "../../shared/icon/icons";

interface SettingsLink {
    path: string;
    icon: IconName;
    label: string;
    description: string;
    adminOnly?: boolean;
}

interface SettingsGroup {
    title: string;
    links: SettingsLink[];
}

const GROUPS: SettingsGroup[] = [
    {
        title: "Boutique",
        links: [
            {
                path: "shop",
                adminOnly: true,
                icon: "store",
                label: "Informations de la boutique",
                description: "Nom, adresse, téléphone, IFU et RCCM",
            },
            {
                path: "receipt",
                adminOnly: true,
                icon: "receipt",
                label: "Ticket de caisse",
                description: "Message imprimé en bas de chaque ticket",
            },
        ],
    },
    {
        title: "Gestion",
        links: [
            {
                path: "stock",
                adminOnly: true,
                icon: "package",
                label: "Stock",
                description: "Seuil d'alerte général des produits",
            },
            {
                path: "alert-email",
                adminOnly: true,
                icon: "mail",
                label: "Email des alertes",
                description: "Résumé du stock envoyé chaque matin par Gmail",
            },
            {
                path: "cash",
                adminOnly: true,
                icon: "banknote",
                label: "Caisse",
                description: "Règles de clôture de la caisse",
            },
            {
                path: "sales",
                adminOnly: true,
                icon: "cart",
                label: "Ventes",
                description: "Numérotation des tickets et remise par défaut",
            },
        ],
    },
    {
        title: "Données",
        links: [
            {
                path: "export",
                adminOnly: true,
                icon: "download",
                label: "Sauvegarde et export",
                description: "Produits, ventes et mouvements en PDF",
            },
        ],
    },
    {
        title: "Mon compte",
        links: [
            {
                path: "account",
                icon: "user",
                label: "Mon profil",
                description: "Votre nom et votre adresse email",
            },
            {
                path: "password",
                icon: "key",
                label: "Mot de passe",
                description: "Changer le mot de passe de connexion",
            },
        ],
    },
];

@Component({
    selector: "app-settings",
    imports: [RouterLink, PageHeader, Icon, Avatar],
    templateUrl: "./settings.html",
    styleUrl: "./settings.css",
})
export class Settings {
    protected auth = inject(AuthService);
    protected theme = inject(ThemeService);

    // l'employé ne voit que son compte
    groups = computed(() =>
        GROUPS.map((group) => ({
            ...group,
            links: group.links.filter((link) => this.auth.isAdmin() || !link.adminOnly),
        })).filter((group) => group.links.length > 0),
    );
}

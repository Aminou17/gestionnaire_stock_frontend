import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { PRODUCT_NAME, COMPANY_NAME } from "../../core/brand";
import { ModuleAccess } from "../../core/modules/module-access";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { ThemeService } from "../../core/theme/theme.service";
import { InstallService } from "../../core/pwa/install.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { Avatar } from "../../shared/avatar/avatar";
import { IconName } from "../../shared/icon/icons";

interface SettingsLink {
    path: string;
    icon: IconName;
    label: string;
    description: string;
    // Couleur de la pastille d'icône
    tone: string;
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
                tone: "#3b82f6",
                adminOnly: true,
                icon: "store",
                label: "Ma boutique",
                description: "Nom, logo, coordonnées et ticket",
            },
        ],
    },
    {
        title: "Mon compte",
        links: [
            {
                path: "account",
                tone: "#3b82f6",
                icon: "user",
                label: "Mon profil",
                description: "Nom, e-mail et photo",
            },
            {
                path: "password",
                tone: "#ec4899",
                icon: "key",
                label: "Mot de passe",
                description: "Modifier votre mot de passe",
            },
        ],
    },
    {
        title: "Gestion",
        links: [
            {
                path: "stock",
                tone: "#f59e0b",
                adminOnly: true,
                icon: "package",
                label: "Stock",
                description: "Seuil d'alerte général",
            },
            {
                path: "alert-email",
                tone: "#0ea5e9",
                adminOnly: true,
                icon: "mail",
                label: "E-mail des alertes",
                description: "Résumé chaque matin",
            },
            {
                path: "cash",
                tone: "#10b981",
                adminOnly: true,
                icon: "banknote",
                label: "Caisse",
                description: "Règles de clôture",
            },
            {
                path: "sales",
                tone: "#6366f1",
                adminOnly: true,
                icon: "cart",
                label: "Ventes",
                description: "Numéros et remise",
            },
        ],
    },
    {
        title: "Données",
        links: [
            {
                path: "export",
                tone: "#64748b",
                adminOnly: true,
                icon: "download",
                label: "Sauvegarde et export",
                description: "Produits, ventes et mouvements",
            },
        ],
    },
    {
        title: "Aide et informations",
        links: [
            {
                path: "/subscription",
                tone: "#f97316",
                adminOnly: true,
                icon: "card",
                label: "Abonnement",
                description: "Votre formule",
            },
            {
                path: "/contact",
                tone: "#0ea5e9",
                icon: "mail",
                label: "Contact",
                description: "Une question ? Écrivez-nous",
            },
            {
                path: "/privacy",
                tone: "#10b981",
                icon: "shield",
                label: "Confidentialité",
                description: "Protection de vos données",
            },
            {
                path: "/terms",
                tone: "#64748b",
                icon: "file-text",
                label: "Conditions d'utilisation",
                description: "Les règles d'usage du service",
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

    protected footer = `${PRODUCT_NAME} par ${COMPANY_NAME}`;
    protected productName = PRODUCT_NAME;
    protected pwa = inject(InstallService);

    private shopService = inject(ShopSettingsService);
    private access = inject(ModuleAccess);

    // L'employé ne voit que son compte
    groups = computed(() =>
        GROUPS.map((group) => ({
            ...group,
            links: group.links
                .filter(
                    (link) =>
                        (this.auth.isAdmin() || !link.adminOnly) &&
                        (this.shopService.subscriptionsEnabled() || link.path !== "/subscription"),
                )
                .map((link) => ({ ...link, locked: this.access.isLocked(link.path) })),
        })).filter((group) => group.links.length > 0),
    );

    logout() {
        this.auth.logoutAsked.set(true);
    }
}

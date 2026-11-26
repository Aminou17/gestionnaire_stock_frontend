import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { PRODUCT_NAME, COMPANY_NAME } from "../../core/brand";
import { ModuleAccess } from "../../core/modules/module-access";
import { CashSettingsService } from "../../core/cash/cash-settings.service";
import { SalesSettingsService } from "../../core/sales/sales-settings.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { AlertEmailService } from "../../core/stock/alert-email.service";
import { StockSettingsService } from "../../core/stock/stock-settings.service";
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

// État d'un réglage, affiché à droite de la ligne
interface SettingsStatus {
    text: string;
    // ok : actif (point vert), off : désactivé (point gris)
    state?: "ok" | "off";
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
    private stockService = inject(StockSettingsService);
    private alertEmailService = inject(AlertEmailService);
    private cashService = inject(CashSettingsService);
    private salesService = inject(SalesSettingsService);

    // Les états ne sont lus que pour l'administrateur : le manager n'a pas accès à ces réglages
    private params = () => (this.auth.isAdmin() ? true : undefined);

    private shop = rxResource({
        params: this.params,
        stream: () => this.shopService.getSettings(),
    });
    private stock = rxResource({
        params: this.params,
        stream: () => this.stockService.getSettings(),
    });
    private alertEmail = rxResource({
        params: this.params,
        stream: () => this.alertEmailService.getSettings(),
    });
    private cash = rxResource({
        params: this.params,
        stream: () => this.cashService.getSettings(),
    });
    private sales = rxResource({
        params: this.params,
        stream: () => this.salesService.getSettings(),
    });

    // Un état n'apparaît que quand la donnée est arrivée : pas de clignotement à l'ouverture
    statuses = computed<Record<string, SettingsStatus>>(() => {
        const statuses: Record<string, SettingsStatus> = {};

        if (this.shop.hasValue()) {
            const shop = this.shop.value();
            statuses["shop"] = {
                text: shop.logo ? "Logo ajouté" : "Sans logo",
                state: shop.logo ? "ok" : "off",
            };
        }

        if (this.stock.hasValue()) {
            const stock = this.stock.value();
            statuses["stock"] = stock
                ? { text: `Seuil : ${stock.min_stock}` }
                : { text: "Non défini", state: "off" };
        }

        if (this.alertEmail.hasValue()) {
            const email = this.alertEmail.value();
            statuses["alert-email"] = email.enabled
                ? { text: `Activé à ${String(email.sendHour).padStart(2, "0")}:00`, state: "ok" }
                : { text: "Désactivé", state: "off" };
        }

        if (this.cash.hasValue()) {
            statuses["cash"] = {
                text: this.cash.value().blind_close ? "À l'aveugle" : "Solde visible",
            };
        }

        if (this.sales.hasValue()) {
            const prefix = this.sales.value().ticket_prefix;
            statuses["sales"] = prefix ? { text: `Préfixe : ${prefix}` } : { text: "Sans préfixe" };
        }

        // La fiche d'abonnement n'est pas encore lue ici : toute boutique démarre par un essai
        if (this.shopService.subscriptionsEnabled() && this.auth.isAdmin()) {
            statuses["/subscription"] = { text: "Essai gratuit" };
        }

        return statuses;
    });

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

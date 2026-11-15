import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { PRODUCT_NAME, COMPANY_NAME } from "../../core/brand";
import { CashSettingsService } from "../../core/cash/cash-settings.service";
import { SalesSettingsService } from "../../core/sales/sales-settings.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { AlertEmailService } from "../../core/stock/alert-email.service";
import { StockSettingsService } from "../../core/stock/stock-settings.service";
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
    // couleur de la pastille d'icône
    tone: string;
    adminOnly?: boolean;
}

// état d'un réglage, affiché à droite de la ligne
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
                description: "Logo, nom, adresse, IFU et RCCM",
            },
            {
                path: "receipt",
                tone: "#8b5cf6",
                adminOnly: true,
                icon: "receipt",
                label: "Ticket de caisse",
                description: "Message en bas de chaque ticket",
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
                label: "Email des alertes",
                description: "Résumé du stock chaque matin",
            },
            {
                path: "cash",
                tone: "#10b981",
                adminOnly: true,
                icon: "banknote",
                label: "Caisse",
                description: "Règles de clôture de la caisse",
            },
            {
                path: "sales",
                tone: "#6366f1",
                adminOnly: true,
                icon: "cart",
                label: "Ventes",
                description: "Numéro des tickets et remise",
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

    private shopService = inject(ShopSettingsService);
    private stockService = inject(StockSettingsService);
    private alertEmailService = inject(AlertEmailService);
    private cashService = inject(CashSettingsService);
    private salesService = inject(SalesSettingsService);

    // les états ne sont lus que pour l'administrateur : le manager n'a pas accès à ces réglages
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

    // un état n'apparaît que quand la donnée est arrivée : pas de clignotement à l'ouverture
    statuses = computed<Record<string, SettingsStatus>>(() => {
        const statuses: Record<string, SettingsStatus> = {};

        if (this.shop.hasValue()) {
            const shop = this.shop.value();
            statuses["shop"] = { text: shop.name };
            statuses["receipt"] = {
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
            const connected = email.enabled && email.hasPassword;
            statuses["alert-email"] = connected
                ? { text: "Gmail connecté", state: "ok" }
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

        return statuses;
    });

    // l'employé ne voit que son compte
    groups = computed(() =>
        GROUPS.map((group) => ({
            ...group,
            links: group.links.filter((link) => this.auth.isAdmin() || !link.adminOnly),
        })).filter((group) => group.links.length > 0),
    );

    logout() {
        this.auth.logoutAsked.set(true);
    }
}

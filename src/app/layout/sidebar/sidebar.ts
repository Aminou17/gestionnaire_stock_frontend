import { Component, computed, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../../shared/icon/icon";
import { IconName } from "../../shared/icon/icons";
import { LayoutService } from "../layout.service";

interface NavItem {
    label: string;
    path: string;
    icon: IconName;
    adminOnly?: boolean;
}

interface NavSection {
    title?: string;
    items: NavItem[];
}

const SECTIONS: NavSection[] = [
    {
        items: [
            { label: "Tableau de bord", path: "/dashboard", icon: "dashboard" },
            { label: "Ventes", path: "/sales", icon: "cart" },
            { label: "Caisse", path: "/cash", icon: "banknote" },
        ],
    },
    {
        title: "Stock",
        items: [
            { label: "Produits", path: "/products", icon: "package" },
            { label: "Catégories", path: "/categories", icon: "tag" },
            { label: "Fournisseurs", path: "/suppliers", icon: "truck", adminOnly: true },
            {
                label: "Entrées de stock",
                path: "/stock-entries",
                icon: "stock-entry",
                adminOnly: true,
            },
            { label: "Mouvements", path: "/stock-movements", icon: "movements" },
            { label: "Inventaires", path: "/inventories", icon: "clipboard", adminOnly: true },
            { label: "Alertes", path: "/alerts", icon: "alert", adminOnly: true },
        ],
    },
    {
        title: "Administration",
        items: [
            { label: "Utilisateurs", path: "/users", icon: "users", adminOnly: true },
            { label: "Journal d'audit", path: "/audit-logs", icon: "audit", adminOnly: true },
        ],
    },
    {
        // ouvert au gérant : il y règle son compte et l'apparence
        title: "Compte",
        items: [{ label: "Paramètres", path: "/settings", icon: "settings" }],
    },
];

@Component({
    selector: "app-sidebar",
    imports: [RouterLink, RouterLinkActive, Icon],
    templateUrl: "./sidebar.html",
    styleUrl: "./sidebar.css",
})
export class Sidebar {
    private auth = inject(AuthService);
    protected layout = inject(LayoutService);
    protected theme = inject(ThemeService);
    protected alerts = inject(LowStockAlertService);

    // le manager ne voit que les pages auxquelles il a accès
    sections = computed(() => {
        const isAdmin = this.auth.isAdmin();
        return SECTIONS.map((section) => ({
            ...section,
            items: section.items.filter((item) => isAdmin || !item.adminOnly),
        })).filter((section) => section.items.length > 0);
    });

    close() {
        this.layout.sidebarOpen.set(false);
    }
}

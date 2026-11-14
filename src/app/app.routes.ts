import { Routes } from "@angular/router";

import { adminGuard } from "./core/auth/admin.guard";
import { authGuard } from "./core/auth/auth.guard";
import { guestGuard } from "./core/auth/guest.guard";
import { ownerGuard } from "./core/auth/owner.guard";
import { shopGuard } from "./core/auth/shop.guard";
import { AuthLayout } from "./features/auth/auth-layout/auth-layout";
import { unsavedChangesGuard } from "./features/settings/unsaved-changes.guard";
import { MainLayout } from "./layout/main-layout/main-layout";

const comingSoon = () => import("./features/coming-soon/coming-soon").then((m) => m.ComingSoon);

// pages pas encore développées : [chemin, titre, réservée à l'admin]
const upcoming: [string, string, boolean][] = [];

export const routes: Routes = [
    { path: "", pathMatch: "full", redirectTo: "dashboard" },
    {
        path: "",
        component: AuthLayout,
        canActivate: [guestGuard],
        children: [
            {
                path: "login",
                title: "Connexion",
                loadComponent: () => import("./features/auth/login/login").then((m) => m.Login),
            },
            {
                path: "register",
                title: "Créer ma boutique",
                loadComponent: () =>
                    import("./features/auth/register/register").then((m) => m.Register),
            },
            {
                path: "forgot-password",
                title: "Mot de passe oublié",
                loadComponent: () =>
                    import("./features/auth/forgot-password/forgot-password").then(
                        (m) => m.ForgotPassword,
                    ),
            },
        ],
    },
    {
        path: "",
        component: MainLayout,
        canActivate: [authGuard, shopGuard],
        children: [
            {
                path: "dashboard",
                title: "Tableau de bord",
                loadComponent: () =>
                    import("./features/dashboard/dashboard").then((m) => m.Dashboard),
            },
            {
                path: "products",
                title: "Produits",
                loadComponent: () => import("./features/products/products").then((m) => m.Products),
            },
            {
                path: "products/:id",
                title: "Produit",
                loadComponent: () =>
                    import("./features/products/product-page/product-page").then(
                        (m) => m.ProductPage,
                    ),
            },
            {
                path: "categories",
                title: "Catégories",
                loadComponent: () =>
                    import("./features/categories/categories").then((m) => m.Categories),
            },
            {
                path: "categories/:id",
                title: "Catégorie",
                loadComponent: () =>
                    import("./features/categories/category-page/category-page").then(
                        (m) => m.CategoryPage,
                    ),
            },
            {
                path: "stock-entries",
                title: "Entrées de stock",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/stock-entries/stock-entries").then((m) => m.StockEntries),
            },
            {
                path: "stock-movements",
                title: "Mouvements de stock",
                loadComponent: () =>
                    import("./features/stock-movements/stock-movements").then(
                        (m) => m.StockMovements,
                    ),
            },
            {
                path: "suppliers",
                title: "Fournisseurs",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/suppliers/suppliers").then((m) => m.Suppliers),
            },
            {
                path: "suppliers/:id",
                title: "Fournisseur",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/suppliers/supplier-page/supplier-page").then(
                        (m) => m.SupplierPage,
                    ),
            },
            {
                path: "users",
                title: "Utilisateurs",
                canActivate: [adminGuard],
                loadComponent: () => import("./features/users/users").then((m) => m.Users),
            },
            {
                path: "users/:id",
                title: "Utilisateur",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/users/user-page/user-page").then((m) => m.UserPage),
            },
            {
                path: "audit-logs",
                title: "Journal d'audit",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/audit-logs/audit-logs").then((m) => m.AuditLogs),
            },
            {
                path: "inventories",
                title: "Inventaires",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/inventories/inventories").then((m) => m.Inventories),
            },
            {
                path: "inventories/new",
                title: "Nouvel inventaire",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/inventories/new-inventory").then((m) => m.NewInventory),
            },
            {
                path: "inventories/:id",
                title: "Inventaire",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/inventories/inventory-page").then((m) => m.InventoryPage),
            },
            {
                path: "alerts",
                title: "Alertes de stock",
                loadComponent: () => import("./features/alerts/alerts").then((m) => m.Alerts),
            },
            {
                path: "alerts/supplier/:id",
                title: "Commande fournisseur",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/alerts/supplier-order/supplier-order").then(
                        (m) => m.SupplierOrder,
                    ),
            },
            {
                path: "alerts/rotation",
                title: "Rotation des produits",
                loadComponent: () =>
                    import("./features/alerts/rotation/rotation").then((m) => m.Rotation),
            },
            {
                path: "sales",
                title: "Ventes",
                loadComponent: () => import("./features/sales/sales").then((m) => m.Sales),
            },
            {
                path: "sales/new",
                title: "Nouvelle vente",
                loadComponent: () =>
                    import("./features/sales/new-sale/new-sale").then((m) => m.NewSale),
            },
            {
                path: "sales/:id",
                title: "Vente",
                loadComponent: () =>
                    import("./features/sales/sale-page/sale-page").then((m) => m.SalePage),
            },
            {
                path: "cash",
                title: "Caisse",
                loadComponent: () => import("./features/cash/cash").then((m) => m.Cash),
            },
            {
                path: "cash/sessions",
                title: "Historique des caisses",
                loadComponent: () =>
                    import("./features/cash/cash-sessions/cash-sessions").then(
                        (m) => m.CashSessions,
                    ),
            },
            {
                path: "cash/movements",
                title: "Mouvements de caisse",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/cash/cash-movements/cash-movements").then(
                        (m) => m.CashMovements,
                    ),
            },
            {
                path: "cash/sessions/:id",
                title: "Caisse",
                loadComponent: () =>
                    import("./features/cash/cash-session-page/cash-session-page").then(
                        (m) => m.CashSessionPage,
                    ),
            },
            {
                // le sommaire et les pages personnelles sont ouverts à l'employé, le reste à l'administrateur
                path: "settings",
                children: [
                    {
                        path: "",
                        title: "Paramètres",
                        loadComponent: () =>
                            import("./features/settings/settings").then((m) => m.Settings),
                    },
                    {
                        path: "shop",
                        title: "Informations de la boutique",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-shop/settings-shop").then(
                                (m) => m.SettingsShop,
                            ),
                    },
                    {
                        path: "receipt",
                        title: "Ticket de caisse",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-receipt/settings-receipt").then(
                                (m) => m.SettingsReceipt,
                            ),
                    },
                    {
                        path: "stock",
                        title: "Paramètres du stock",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-stock/settings-stock").then(
                                (m) => m.SettingsStock,
                            ),
                    },
                    {
                        path: "alert-email",
                        title: "Email des alertes",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-alert-email/settings-alert-email").then(
                                (m) => m.SettingsAlertEmail,
                            ),
                    },
                    {
                        path: "cash",
                        title: "Paramètres de la caisse",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-cash/settings-cash").then(
                                (m) => m.SettingsCash,
                            ),
                    },
                    {
                        path: "sales",
                        title: "Paramètres des ventes",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-sales/settings-sales").then(
                                (m) => m.SettingsSales,
                            ),
                    },
                    {
                        path: "export",
                        title: "Sauvegarde et export",
                        canActivate: [adminGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-export/settings-export").then(
                                (m) => m.SettingsExport,
                            ),
                    },
                    {
                        path: "account",
                        title: "Mon profil",
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-account/settings-account").then(
                                (m) => m.SettingsAccount,
                            ),
                    },
                    {
                        path: "password",
                        title: "Mot de passe",
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-password/settings-password").then(
                                (m) => m.SettingsPassword,
                            ),
                    },
                ],
            },
            ...upcoming.map(([path, heading, adminOnly]) => ({
                path,
                title: heading,
                data: { heading },
                canActivate: adminOnly ? [adminGuard] : [],
                loadComponent: comingSoon,
            })),
        ],
    },
    {
        path: "owner",
        canActivate: [authGuard, ownerGuard],
        loadComponent: () =>
            import("./features/owner/owner-layout/owner-layout").then((m) => m.OwnerLayout),
        children: [
            {
                path: "",
                title: "Boutiques",
                loadComponent: () => import("./features/owner/shops/shops").then((m) => m.Shops),
            },
            {
                path: "password",
                title: "Mot de passe",
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () =>
                    import("./features/settings/settings-password/settings-password").then(
                        (m) => m.SettingsPassword,
                    ),
            },
        ],
    },
    { path: "**", redirectTo: "dashboard" },
];

import { Routes } from "@angular/router";

import { accessGuard } from "./core/auth/access.guard";
import { adminGuard } from "./core/auth/admin.guard";
import { authGuard } from "./core/auth/auth.guard";
import { guestGuard } from "./core/auth/guest.guard";
import { ownerGuard } from "./core/auth/owner.guard";
import { passwordChangeGuard } from "./core/auth/password-change.guard";
import { shopGuard } from "./core/auth/shop.guard";
import { welcomeGuard } from "./features/auth/welcome/welcome.guard";
import { AuthLayout } from "./features/auth/auth-layout/auth-layout";
import { unsavedChangesGuard } from "./features/settings/unsaved-changes.guard";
import { MainLayout } from "./layout/main-layout/main-layout";

const comingSoon = () => import("./features/coming-soon/coming-soon").then((m) => m.ComingSoon);

// pages pas encore développées : [chemin, titre, réservée à l'admin]
const upcoming: [string, string, boolean][] = [];

export const routes: Routes = [
    { path: "", pathMatch: "full", redirectTo: "dashboard" },
    {
        // le lien reçu par e-mail s'ouvre même si quelqu'un est déjà connecté sur cet appareil
        path: "reset-password",
        component: AuthLayout,
        children: [
            {
                path: "",
                title: "Nouveau mot de passe",
                loadComponent: () =>
                    import("./features/auth/reset-password/reset-password").then(
                        (m) => m.ResetPassword,
                    ),
            },
        ],
    },
    {
        // pages publiques : visibles avec ou sans session
        path: "privacy",
        title: "Politique de confidentialité",
        loadComponent: () => import("./features/legal/privacy/privacy").then((m) => m.Privacy),
    },
    {
        path: "terms",
        title: "Conditions d'utilisation",
        loadComponent: () => import("./features/legal/terms/terms").then((m) => m.Terms),
    },
    {
        path: "contact",
        title: "Contact",
        loadComponent: () => import("./features/legal/contact/contact").then((m) => m.Contact),
    },
    {
        path: "welcome",
        title: "Bienvenue",
        canActivate: [guestGuard],
        loadComponent: () => import("./features/auth/welcome/welcome").then((m) => m.Welcome),
    },
    {
        path: "",
        component: AuthLayout,
        canActivate: [guestGuard],
        children: [
            {
                path: "login",
                title: "Connexion",
                canActivate: [welcomeGuard],
                loadComponent: () => import("./features/auth/login/login").then((m) => m.Login),
            },
            {
                path: "register",
                title: "Créer ma boutique",
                canActivate: [welcomeGuard],
                loadComponent: () =>
                    import("./features/auth/register/register").then((m) => m.Register),
            },
            {
                path: "verify-email",
                title: "Confirmez votre adresse",
                loadComponent: () =>
                    import("./features/auth/verify-email/verify-email").then((m) => m.VerifyEmail),
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
        // essai ou abonnement terminé : une page à part, sans le menu dont les pages sont fermées
        path: "access-ended",
        component: AuthLayout,
        canActivate: [authGuard, shopGuard],
        children: [
            {
                path: "",
                title: "Accès terminé",
                loadComponent: () =>
                    import("./features/access-ended/access-ended").then((m) => m.AccessEnded),
            },
        ],
    },
    {
        path: "",
        component: MainLayout,
        canActivate: [authGuard, shopGuard, accessGuard],
        canActivateChild: [passwordChangeGuard],
        children: [
            {
                path: "dashboard",
                title: "Accueil",
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
                path: "admin",
                title: "Espace admin",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/admin-space/admin-space").then((m) => m.AdminSpace),
            },
            {
                path: "stock-entries/new",
                title: "Nouvelle entrée de stock",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/stock-entries/new-stock-entry/new-stock-entry").then(
                        (m) => m.NewStockEntry,
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
                title: "Historique du stock",
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
                title: "Historique des actions",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/audit-logs/audit-logs").then((m) => m.AuditLogs),
            },
            {
                path: "subscription",
                title: "Abonnement",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/subscription/subscription").then((m) => m.Subscription),
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
                title: "Vitesse de vente",
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
                path: "customers",
                title: "Clients",
                loadComponent: () =>
                    import("./features/customers/customers").then((m) => m.Customers),
            },
            {
                path: "customers/:id",
                title: "Client",
                loadComponent: () =>
                    import("./features/customers/customer-page/customer-page").then(
                        (m) => m.CustomerPage,
                    ),
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
                path: "expenses",
                title: "Dépenses",
                canActivate: [adminGuard],
                loadComponent: () => import("./features/expenses/expenses").then((m) => m.Expenses),
            },
            {
                path: "expenses/new",
                title: "Nouvelle dépense",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/expenses/new-expense/new-expense").then((m) => m.NewExpense),
            },
            {
                path: "expenses/:id",
                title: "Dépense",
                canActivate: [adminGuard],
                loadComponent: () =>
                    import("./features/expenses/expense-page/expense-page").then(
                        (m) => m.ExpensePage,
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
                path: "support",
                title: "Assistance",
                data: { side: "user" },
                loadComponent: () =>
                    import("./features/support/support-inbox").then((m) => m.SupportInbox),
            },
            {
                path: "support/new",
                title: "Nouveau message",
                data: { side: "user", compose: true },
                loadComponent: () =>
                    import("./features/support/support-inbox").then((m) => m.SupportInbox),
            },
            {
                path: "support/:id",
                title: "Assistance",
                data: { side: "user" },
                loadComponent: () =>
                    import("./features/support/support-inbox").then((m) => m.SupportInbox),
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
                        title: "Ma boutique",
                        canActivate: [adminGuard],
                        canDeactivate: [unsavedChangesGuard],
                        loadComponent: () =>
                            import("./features/settings/settings-shop/settings-shop").then(
                                (m) => m.SettingsShop,
                            ),
                    },
                    // le ticket de caisse se règle maintenant dans Ma boutique
                    { path: "receipt", redirectTo: "shop" },
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
                        title: "E-mail des alertes",
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
                        path: "install",
                        title: "Installer l'application",
                        loadComponent: () =>
                            import("./features/settings/settings-install/settings-install").then(
                                (m) => m.SettingsInstall,
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
                path: "shops/:id",
                title: "Boutique",
                loadComponent: () =>
                    import("./features/owner/shop-page/shop-page").then((m) => m.ShopPage),
            },
            {
                path: "support",
                title: "Messages des boutiques",
                data: { side: "owner" },
                loadComponent: () =>
                    import("./features/support/support-inbox").then((m) => m.SupportInbox),
            },
            {
                path: "support/:id",
                title: "Messages des boutiques",
                data: { side: "owner" },
                loadComponent: () =>
                    import("./features/support/support-inbox").then((m) => m.SupportInbox),
            },
            {
                path: "mail",
                title: "E-mails d'envoi",
                loadComponent: () =>
                    import("./features/owner/mail-settings/mail-settings").then(
                        (m) => m.MailSettingsPage,
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
    { path: "**", redirectTo: "dashboard" },
];

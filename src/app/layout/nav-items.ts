import { IconName } from "../shared/icon/icons";

export interface NavItem {
    label: string;
    path?: string;
    icon: IconName;
    adminOnly?: boolean;
    // paramètres d'adresse, par exemple ?adjust=1 pour ouvrir une fenêtre à l'arrivée
    queryParams?: Record<string, string>;
    // allumé seulement sur sa propre URL, pas sur ses sous-pages
    exact?: boolean;
    children?: NavItem[];
}

export interface NavSection {
    title?: string;
    items: NavItem[];
}

export const SECTIONS: NavSection[] = [
    {
        items: [
            { label: "Accueil", path: "/dashboard", icon: "dashboard" },
            { label: "Ventes", path: "/sales", icon: "cart" },
            { label: "Clients", path: "/customers", icon: "user" },
            { label: "Caisse", path: "/cash", icon: "banknote" },
        ],
    },
    {
        title: "Stock",
        items: [
            { label: "Produits", path: "/products", icon: "package" },
            { label: "Historique du stock", path: "/stock-movements", icon: "movements" },
            {
                label: "Corriger le stock",
                path: "/products",
                queryParams: { adjust: "1" },
                icon: "edit",
                exact: true,
                adminOnly: true,
            },
            { label: "Inventaire", path: "/inventories", icon: "clipboard", adminOnly: true },
            { label: "Catégories", path: "/categories", icon: "tag" },
            { label: "Meilleures ventes", path: "/alerts/rotation", icon: "trending-up" },
        ],
    },
    {
        title: "Achats",
        items: [
            { label: "Réceptions", path: "/stock-entries", icon: "stock-entry", adminOnly: true },
            { label: "Fournisseurs", path: "/suppliers", icon: "truck", adminOnly: true },
            // la rotation a sa propre ligne dans Stock : Stock bas ne doit pas s'allumer dessus
            { label: "Stock bas", path: "/alerts", icon: "alert", exact: true },
        ],
    },
    {
        title: "Équipe",
        items: [
            { label: "Utilisateurs", path: "/users", icon: "users", adminOnly: true },
            {
                label: "Historique des actions",
                path: "/audit-logs",
                icon: "audit",
                adminOnly: true,
            },
        ],
    },
];

// liens secondaires en bas du menu : compte et boutique, puis aide
export const FOOTER_LINKS: NavItem[] = [
    { label: "Paramètres", path: "/settings", icon: "settings" },
    { label: "Abonnement", path: "/subscription", icon: "card", adminOnly: true },
];

export const HELP_LINKS: NavItem[] = [
    { label: "Contact", path: "/contact", icon: "message" },
    { label: "Confidentialité", path: "/privacy", icon: "shield" },
    { label: "Conditions", path: "/terms", icon: "file-text" },
];

// pages proposées par la recherche, selon le rôle
export function searchablePages(
    isAdmin: boolean,
): { label: string; hint: string; path: string; icon: IconName }[] {
    const pages = SECTIONS.flatMap((section) =>
        section.items.map((page) => ({ ...page, hint: section.title ?? "Menu" })),
    )
        .filter((page) => isAdmin || !page.adminOnly)
        .map((page) => ({ label: page.label, hint: page.hint, path: page.path!, icon: page.icon }));

    return [
        { label: "Nouvelle vente", hint: "Action", path: "/sales/new", icon: "plus" },
        ...pages,
        { label: "Paramètres", hint: "Compte", path: "/settings", icon: "settings" },
        ...(isAdmin
            ? [
                  {
                      label: "Abonnement",
                      hint: "Compte",
                      path: "/subscription",
                      icon: "card" as const,
                  },
              ]
            : []),
        { label: "Mon profil", hint: "Compte", path: "/settings/account", icon: "user" },
        { label: "Mot de passe", hint: "Compte", path: "/settings/password", icon: "key" },
    ];
}

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

// Accueil, Ventes, Clients, Caisse et Dépenses en direct ; le reste est rangé en deux groupes qui
// s'ouvrent seuls quand on est dans leurs pages, comme Shopify : peu de lignes à lire
export const SECTIONS: NavSection[] = [
    {
        items: [
            { label: "Accueil", path: "/dashboard", icon: "dashboard" },
            { label: "Ventes", path: "/sales", icon: "cart" },
            { label: "Clients", path: "/customers", icon: "user" },
            { label: "Caisse", path: "/cash", icon: "banknote" },
            { label: "Dépenses", path: "/expenses", icon: "receipt", adminOnly: true },
            { label: "Espace admin", path: "/admin", icon: "shield", adminOnly: true },
            {
                label: "Stock",
                icon: "package",
                children: [
                    { label: "Produits", path: "/products", icon: "package" },
                    { label: "Catégories", path: "/categories", icon: "tag" },
                    {
                        label: "Inventaires",
                        path: "/inventories",
                        icon: "clipboard",
                        adminOnly: true,
                    },
                    {
                        label: "Corriger le stock",
                        path: "/products",
                        queryParams: { adjust: "1" },
                        icon: "edit",
                        exact: true,
                        adminOnly: true,
                    },
                    { label: "Historique du stock", path: "/stock-movements", icon: "movements" },
                    // la rotation a sa propre ligne : les alertes ne doivent pas s'allumer dessus
                    { label: "Alertes de stock", path: "/alerts", icon: "alert", exact: true },
                    {
                        label: "Rotation des produits",
                        path: "/alerts/rotation",
                        icon: "trending-up",
                    },
                    // les achats sont rangés ici : entrées de marchandise et fournisseurs
                    {
                        label: "Entrées de stock",
                        path: "/stock-entries",
                        icon: "stock-entry",
                        adminOnly: true,
                    },
                    { label: "Fournisseurs", path: "/suppliers", icon: "truck", adminOnly: true },
                ],
            },
            {
                label: "Équipe",
                icon: "users",
                adminOnly: true,
                children: [
                    { label: "Utilisateurs", path: "/users", icon: "users", adminOnly: true },
                    {
                        label: "Historique des actions",
                        path: "/audit-logs",
                        icon: "audit",
                        adminOnly: true,
                    },
                ],
            },
        ],
    },
];

// lien fixe en bas du menu ; l'abonnement se trouve dans les paramètres
export const FOOTER_LINKS: NavItem[] = [
    { label: "Paramètres", path: "/settings", icon: "settings" },
];

// pages proposées par la recherche, selon le rôle
export function searchablePages(
    isAdmin: boolean,
): { label: string; hint: string; path: string; icon: IconName }[] {
    const pages = SECTIONS.flatMap((section) =>
        section.items.flatMap((item) =>
            (item.children ?? [item]).map((page) => ({
                ...page,
                hint: item.children ? item.label : (section.title ?? "Menu"),
            })),
        ),
    )
        .filter((page) => isAdmin || !page.adminOnly)
        .map((page) => ({ label: page.label, hint: page.hint, path: page.path!, icon: page.icon }));

    return [
        { label: "Nouvelle vente", hint: "Action", path: "/sales/new", icon: "plus" },
        ...(isAdmin
            ? [
                  {
                      label: "Nouvelle dépense",
                      hint: "Action",
                      path: "/expenses/new",
                      icon: "receipt" as const,
                  },
              ]
            : []),
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

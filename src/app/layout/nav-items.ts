import { IconName } from "../shared/icon/icons";

export interface NavItem {
    label: string;
    path?: string;
    icon: IconName;
    adminOnly?: boolean;
    // Paramètres d'adresse, par exemple ?adjust=1 pour ouvrir une fenêtre à l'arrivée
    queryParams?: Record<string, string>;
    // Allumé seulement sur sa propre URL, pas sur ses sous-pages
    exact?: boolean;
    children?: NavItem[];
}

export interface NavSection {
    title?: string;
    items: NavItem[];
}

// Les pages de tous les jours en direct ; le reste est rangé dans le groupe « Plus d'outils »,
// du plus utilisé au moins utilisé, qui s'ouvre seul quand on est dans ses pages
export const SECTIONS: NavSection[] = [
    {
        items: [
            { label: "Accueil", path: "/dashboard", icon: "dashboard" },
            { label: "Ventes", path: "/sales", icon: "cart" },
            { label: "Produits", path: "/products", icon: "package" },
            { label: "Clients et crédits", path: "/customers", icon: "user" },
            { label: "Caisse", path: "/cash", icon: "banknote" },
            { label: "Dépenses", path: "/expenses", icon: "receipt", adminOnly: true },
            { label: "Bilan", path: "/admin", icon: "shield", adminOnly: true },
            {
                label: "Plus d'outils",
                icon: "more",
                children: [
                    {
                        label: "Entrées de stock",
                        path: "/stock-entries",
                        icon: "stock-entry",
                        adminOnly: true,
                    },
                    // La rotation a sa propre ligne : les alertes ne doivent pas s'allumer dessus
                    { label: "Alertes de stock", path: "/alerts", icon: "alert", exact: true },
                    { label: "Inventaires", path: "/inventories", icon: "clipboard" },
                    {
                        label: "Corriger la quantité",
                        path: "/products",
                        queryParams: { adjust: "1" },
                        icon: "edit",
                        exact: true,
                        adminOnly: true,
                    },
                    { label: "Catégories", path: "/categories", icon: "tag" },
                    { label: "Fournisseurs", path: "/suppliers", icon: "truck", adminOnly: true },
                    { label: "Historique du stock", path: "/stock-movements", icon: "movements" },
                    {
                        label: "Vitesse de vente",
                        path: "/alerts/rotation",
                        icon: "trending-up",
                    },
                    { label: "Employés", path: "/users", icon: "users", adminOnly: true },
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

// Lien fixe en bas du menu ; l'abonnement se trouve dans les paramètres
export const FOOTER_LINKS: NavItem[] = [
    { label: "Paramètres", path: "/settings", icon: "settings" },
];

// Pages proposées par la recherche, selon le rôle
export function searchablePages(
    isAdmin: boolean,
    options: { subscriptions?: boolean; allowsPath?: (path: string) => boolean } = {},
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
        .map((page) => ({
            label: page.label,
            // Une fonction hors de la formule reste proposée, avec la mention Abonnement
            hint:
                options.allowsPath?.(page.path!) === false
                    ? `${page.hint} · Abonnement`
                    : page.hint,
            path: page.path!,
            icon: page.icon,
        }));

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
        ...(isAdmin && options.subscriptions
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

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
            { label: "Tableau de bord", path: "/dashboard", icon: "dashboard" },
            { label: "Ventes", path: "/sales", icon: "cart" },
            { label: "Caisse", path: "/cash", icon: "banknote" },
            { label: "Produits", path: "/products", icon: "package" },
            {
                label: "Stock",
                icon: "movements",
                children: [
                    { label: "Mouvements", path: "/stock-movements", icon: "movements" },
                    {
                        label: "Ajuster le stock",
                        path: "/stock-movements",
                        queryParams: { adjust: "1" },
                        icon: "edit",
                        adminOnly: true,
                    },
                    {
                        label: "Inventaires",
                        path: "/inventories",
                        icon: "clipboard",
                        adminOnly: true,
                    },
                    { label: "Catégories", path: "/categories", icon: "tag" },
                    {
                        label: "Rotation des produits",
                        path: "/alerts/rotation",
                        icon: "trending-up",
                    },
                ],
            },
            {
                label: "Réapprovisionnement",
                icon: "truck",
                children: [
                    {
                        label: "Entrées de stock",
                        path: "/stock-entries",
                        icon: "stock-entry",
                        adminOnly: true,
                    },
                    { label: "Fournisseurs", path: "/suppliers", icon: "truck", adminOnly: true },
                    // la rotation a sa propre ligne dans Stock : Alertes ne doit pas s'allumer dessus
                    { label: "Alertes", path: "/alerts", icon: "alert", exact: true },
                ],
            },
            {
                label: "Administration",
                icon: "users",
                children: [
                    { label: "Comptes", path: "/users", icon: "users", adminOnly: true },
                    {
                        label: "Journal d'audit",
                        path: "/audit-logs",
                        icon: "audit",
                        adminOnly: true,
                    },
                ],
            },
        ],
    },
];

// pages proposées par la recherche, selon le rôle
export function searchablePages(
    isAdmin: boolean,
): { label: string; hint: string; path: string; icon: IconName }[] {
    const pages = SECTIONS.flatMap((section) =>
        section.items.flatMap((item) =>
            (item.children ?? [item]).map((page) => ({
                ...page,
                hint: item.children ? item.label : "Menu",
            })),
        ),
    )
        .filter((page) => isAdmin || !page.adminOnly)
        .map((page) => ({ label: page.label, hint: page.hint, path: page.path!, icon: page.icon }));

    return [
        { label: "Nouvelle vente", hint: "Action", path: "/sales/new", icon: "plus" },
        ...pages,
        { label: "Paramètres", hint: "Compte", path: "/settings", icon: "settings" },
        { label: "Mon profil", hint: "Compte", path: "/settings/account", icon: "user" },
        { label: "Mot de passe", hint: "Compte", path: "/settings/password", icon: "key" },
    ];
}

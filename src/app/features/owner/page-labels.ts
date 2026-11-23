// Noms des pages de l'application, tels que le propriétaire les lit dans l'activité d'une boutique
// (les numéros de l'adresse sont déjà remplacés par :id)
const LABELS: Record<string, string> = {
    "/dashboard": "Accueil",
    "/sales": "Ventes",
    "/sales/new": "Nouvelle vente",
    "/sales/:id": "Fiche d'une vente",
    "/customers": "Clients et crédits",
    "/customers/:id": "Fiche d'un client",
    "/cash": "Caisse",
    "/cash/sessions": "Suivi des caisses",
    "/cash/sessions/:id": "Détail d'une caisse",
    "/expenses": "Dépenses",
    "/expenses/new": "Nouvelle dépense",
    "/expenses/:id": "Fiche d'une dépense",
    "/admin": "Bilan",
    "/products": "Produits",
    "/products/:id": "Fiche d'un produit",
    "/categories": "Catégories",
    "/categories/:id": "Fiche d'une catégorie",
    "/inventories": "Inventaires",
    "/inventories/new": "Nouvel inventaire",
    "/inventories/:id": "Fiche d'un inventaire",
    "/stock-movements": "Historique du stock",
    "/alerts": "Alertes de stock",
    "/alerts/rotation": "Vitesse de vente",
    "/stock-entries": "Entrées de stock",
    "/stock-entries/new": "Nouvelle entrée de stock",
    "/suppliers": "Fournisseurs",
    "/suppliers/:id": "Fiche d'un fournisseur",
    "/users": "Employés",
    "/users/:id": "Fiche d'un employé",
    "/audit-logs": "Historique des actions",
    "/settings": "Paramètres",
    "/support": "Aide",
};

export const pageLabel = (page: string) => LABELS[page] ?? page;

// rubrique de l'application où se range une page, pour regrouper l'activité
export const pageSection = (page: string) => {
    const rules: [string, string][] = [
        ["/sales", "Ventes"],
        ["/customers", "Clients et crédits"],
        ["/cash", "Caisse"],
        ["/expenses", "Caisse"],
        ["/products", "Produits"],
        ["/categories", "Produits"],
        ["/stock-movements", "Stock et achats"],
        ["/stock-entries", "Stock et achats"],
        ["/inventories", "Stock et achats"],
        ["/alerts", "Stock et achats"],
        ["/suppliers", "Stock et achats"],
        ["/dashboard", "Accueil"],
        ["/admin", "Avancé"],
        ["/users", "Avancé"],
        ["/audit-logs", "Avancé"],
        ["/settings", "Avancé"],
    ];

    return (
        rules.find(([prefix]) => page === prefix || page.startsWith(prefix + "/"))?.[1] ?? "Autres"
    );
};

// pages que l'on peut ouvrir sans choisir un élément précis : sert à repérer celles qui ne sont jamais ouvertes
export const OPENABLE_PAGES = Object.keys(LABELS).filter(
    (page) => !page.includes(":id") && page !== "/support",
);

// Noms des ressources de l'API, pour dire en mots simples ce qu'un compte a essayé d'ouvrir
const API_LABELS: Record<string, string> = {
    categories: "Catégories",
    products: "Produits",
    stock_entries: "Entrées de stock",
    stock_movements: "Historique du stock",
    sales: "Ventes",
    inventories: "Inventaires",
    cash_controls: "Contrôles de caisse",
    cash_movements: "Mouvements de caisse",
    cash_sessions: "Suivi des caisses",
    suppliers: "Fournisseurs",
    customers: "Clients et crédits",
    users: "Employés",
    "audit-logs": "Historique des actions",
    "stock-settings": "Réglages du stock",
    "shop-settings": "Réglages de la boutique",
    "sales-settings": "Réglages des ventes",
    "cash-settings": "Réglages de la caisse",
    "low-stock-alerts": "Alertes de stock",
    "alert-email": "E-mail d'alerte",
    dashboard: "Tableau de bord",
    reports: "Rapports",
    exports: "Exports",
    shops: "Boutiques",
    security: "Sécurité",
    "mail-settings": "E-mails d'envoi",
    platform: "Réglages de la plateforme",
    usage: "Activité des boutiques",
};

// "/low-stock-alerts" devient « Alertes de stock »
export const apiLabel = (path: string) =>
    API_LABELS[path.split("/").filter(Boolean)[0] ?? ""] ?? "Page protégée";

// "GET /low-stock-alerts" devient « a essayé d'ouvrir : Alertes de stock »
export const accessAttempt = (method: string | undefined, path: string) => {
    const name = apiLabel(path);
    const action = !method || method === "GET" ? "d'ouvrir" : "de modifier";

    return `a essayé ${action} : ${name}`;
};

// rôle d'un compte, en français
export const roleLabel = (role: string) =>
    role === "admin"
        ? "Administrateur"
        : role === "manager"
          ? "Employé"
          : role === "owner"
            ? "Propriétaire"
            : role;

import { IconName } from "./icon/icons";

// Libellés des actions du journal d'audit, écrits du point de vue de la boutique
export const LABELS: Record<string, string> = {
    AUTH_LOGIN_SUCCEEDED: "S'est connecté",
    AUTH_LOGIN_FAILED: "Connexion échouée",
    ACCESS_DENIED: "Accès refusé",
    PASSWORD_CHANGED: "A changé son mot de passe",
    PASSWORD_CHANGE_FAILED: "Mot de passe actuel incorrect",
    PROFILE_UPDATED: "A modifié son profil",
    SALE_CREATED: "Vente enregistrée",
    SALE_CANCELLED: "Vente remboursée",
    SALES_EXPORTED: "Ventes exportées",
    CASH_SESSION_OPENED: "Caisse ouverte",
    CASH_SESSION_CLOSED: "Caisse clôturée",
    CASH_SESSION_GAP_EXPLAINED: "Écart de caisse expliqué",
    CASH_MOVEMENT_CREATED: "Mouvement de caisse",
    STOCK_ENTRY_CREATED: "Entrée de stock",
    INVENTORY_CREATED: "Inventaire enregistré",
    PRODUCT_CREATED: "Produit créé",
    PRODUCT_UPDATED: "Produit modifié",
    PRODUCT_DEACTIVATED: "Produit supprimé",
    PRODUCTS_EXPORTED: "Produits exportés",
    CATEGORY_CREATED: "Catégorie créée",
    CATEGORY_UPDATED: "Catégorie modifiée",
    CATEGORY_DEACTIVATED: "Catégorie supprimée",
    CATEGORY_RESTORED: "Catégorie restaurée",
    SUPPLIER_CREATED: "Fournisseur créé",
    SUPPLIER_UPDATED: "Fournisseur modifié",
    SUPPLIER_DEACTIVATED: "Fournisseur supprimé",
    SUPPLIER_RESTORED: "Fournisseur restauré",
    USER_CREATED: "Utilisateur créé",
    USER_UPDATED: "Utilisateur modifié",
    USER_DEACTIVATED: "Utilisateur supprimé",
    USER_RESTORED: "Utilisateur restauré",
    USER_PASSWORD_RESET: "Mot de passe d'un utilisateur changé",
    SHOP_SETTINGS_UPDATED: "Informations de la boutique modifiées",
    SHOP_LOGO_UPDATED: "Logo modifié",
    SHOP_LOGO_REMOVED: "Logo retiré",
    SALES_SETTINGS_UPDATED: "Paramètres des ventes modifiés",
    STOCK_SETTINGS_UPDATED: "Paramètres du stock modifiés",
    CASH_SETTINGS_UPDATED: "Paramètres de la caisse modifiés",
};

// une action ajoutée plus tard au backend reste affichée, sans libellé inventé
export const getActivityLabel = (action: string) => LABELS[action] ?? "Autre action";

// une icône par famille d'action, pour repérer le type d'un coup d'oeil
export const getActivityIcon = (action: string): IconName => {
    if (action.startsWith("AUTH_")) return "user";
    if (action === "ACCESS_DENIED") return "ban";
    if (action.startsWith("PASSWORD_") || action === "USER_PASSWORD_RESET") return "key";
    if (action.startsWith("SALE")) return "cart";
    if (action.startsWith("CASH_SESSION") || action.startsWith("CASH_MOVEMENT")) return "wallet";
    if (action.startsWith("STOCK_") || action.startsWith("INVENTORY")) return "package";
    if (action.startsWith("PRODUCT")) return "box";
    if (action.startsWith("USER")) return "users";
    if (action.endsWith("SETTINGS_UPDATED") || action.startsWith("SHOP_")) return "settings";
    return "audit";
};

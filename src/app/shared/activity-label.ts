import { IconName } from "./icon/icons";

// Libellés des actions du journal d'audit, écrits du point de vue de la boutique
export const LABELS: Record<string, string> = {
    AUTH_LOGIN_SUCCEEDED: "S'est connecté",
    AUTH_LOGIN_FAILED: "Connexion échouée",
    AUTH_LOGOUT_ALL: "Déconnecté de tous les appareils",
    ACCESS_DENIED: "Accès refusé",
    PASSWORD_CHANGED: "A changé son mot de passe",
    PASSWORD_CHANGE_FAILED: "Mot de passe actuel incorrect",
    TWO_FACTOR_ENABLED: "A activé la double authentification",
    TWO_FACTOR_DISABLED: "A désactivé la double authentification",
    TWO_FACTOR_FAILED: "Code de double authentification incorrect",
    PASSWORD_RESET_REQUESTED: "A demandé un lien pour changer son mot de passe",
    PASSWORD_RESET_COMPLETED: "A choisi un nouveau mot de passe avec le lien reçu",
    SHOP_ADMIN_RESET_LINK_SENT: "Lien de réinitialisation envoyé par le service client",
    SHOP_ADMIN_TEMP_PASSWORD_SET: "Mot de passe provisoire donné par le service client",
    PROFILE_UPDATED: "A modifié son profil",
    SALE_CREATED: "Vente enregistrée",
    SALE_PAYMENT_ADDED: "Paiement encaissé",
    SALE_ITEM_RETURNED: "Article rendu",
    SALE_CANCELLED: "Vente remboursée",
    EXPORT_CREATED: "Export créé",
    SALES_EXPORTED: "Ventes exportées",
    CASH_SESSION_OPENED: "Caisse ouverte",
    CASH_SESSION_CLOSED: "Caisse comptée",
    CASH_SESSION_RECOUNTED: "Comptage rectifié",
    CASH_SESSION_GAP_EXPLAINED: "Écart de caisse expliqué",
    CASH_SESSION_REOPENED: "Caisse rouverte",
    CASH_MOVEMENT_CREATED: "Mouvement de caisse",
    STOCK_ENTRY_CREATED: "Entrée de stock",
    STOCK_ADJUSTED: "Ajustement de stock",
    INVENTORY_CREATED: "Inventaire enregistré",
    INVENTORY_STARTED: "Comptage commencé",
    INVENTORY_COUNTED: "Comptage terminé",
    INVENTORY_APPLIED: "Stock corrigé d'après un inventaire",
    INVENTORY_CANCELLED: "Inventaire annulé",
    PRODUCT_CREATED: "Produit créé",
    PRODUCT_UPDATED: "Produit modifié",
    PRODUCT_IMAGE_UPDATED: "Photo du produit modifiée",
    PRODUCTS_IMPORTED: "Produits importés",
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
    CUSTOMER_CREATED: "Client ajouté",
    CUSTOMER_UPDATED: "Client modifié",
    CUSTOMER_DEACTIVATED: "Client désactivé",
    CUSTOMER_RESTORED: "Client restauré",
    USER_CREATED: "Employé créé",
    USER_UPDATED: "Employé modifié",
    USER_DEACTIVATED: "Employé supprimé",
    USER_RESTORED: "Employé restauré",
    USER_PASSWORD_RESET: "Mot de passe d'un employé changé",
    SHOP_SETTINGS_UPDATED: "Informations de la boutique modifiées",
    SHOP_LOGO_UPDATED: "Logo modifié",
    SHOP_LOGO_REMOVED: "Logo retiré",
    SALES_SETTINGS_UPDATED: "Paramètres des ventes modifiés",
    STOCK_SETTINGS_UPDATED: "Paramètres du stock modifiés",
    CASH_SETTINGS_UPDATED: "Paramètres de la caisse modifiés",
    ALERT_EMAIL_SETTINGS_UPDATED: "E-mail des alertes modifié",
    ALERT_EMAIL_TEST_SENT: "E-mail d'essai des alertes envoyé",
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

export type ActivityTone = "success" | "info" | "danger" | "violet" | "neutral";

// la couleur dit la nature de l'action : création, modification, suppression, sécurité
export const getActivityTone = (action: string, failed = false): ActivityTone => {
    if (failed || action.endsWith("_DEACTIVATED") || action.endsWith("_REMOVED")) return "danger";
    if (action === "SALE_CANCELLED" || action === "SALE_ITEM_RETURNED") return "danger";
    if (action === "AUTH_LOGIN_SUCCEEDED") return "neutral";
    if (action.startsWith("PASSWORD_") || action.startsWith("SHOP_ADMIN_")) return "violet";
    if (action === "USER_PASSWORD_RESET") return "violet";
    if (action.endsWith("_EXPORTED")) return "neutral";
    if (action.endsWith("_CREATED") || action.endsWith("_RESTORED")) return "success";
    if (action === "CASH_SESSION_OPENED" || action === "SALE_PAYMENT_ADDED") return "success";
    return "info";
};

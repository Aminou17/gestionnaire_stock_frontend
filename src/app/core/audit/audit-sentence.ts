import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { AuditLog } from "./audit-log.model";

// Phrase lisible par la boutique : "Awa a créé la catégorie Tissus".
// verb suit le nom de l'auteur, object est mis en gras, note complète la phrase.
export interface AuditSentence {
    verb: string;
    object?: string;
    note?: string;
}

export interface AuditChange {
    label: string;
    before: string;
    after: string;
}

const fcfa = new FcfaPipe();

// type d'export enregistré par l'API, dit comme dans la phrase
const EXPORT_LABELS: Record<string, string> = {
    produits: "les produits",
    ventes: "les ventes",
    depenses: "les dépenses",
    "mouvements-stock": "les mouvements de stock",
    inventaires: "la liste des inventaires",
    inventaire: "un inventaire",
    "historique-caisses": "l'historique des caisses",
    "bon-de-commande": "un bon de commande",
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const money = (value: unknown) =>
    value === null || value === undefined ? null : fcfa.transform(Number(value));

const part = (log: AuditLog, key: "before" | "after") => {
    const value = log.details?.[key];
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

// le nom enregistré au moment de l'action, sinon le nom actuel renvoyé par l'API
const objectName = (log: AuditLog) => {
    const name =
        text(part(log, "after")?.["name"]) ??
        text(log.details?.["name"]) ??
        log.entity_name ??
        (log.entity_id ? `n° ${log.entity_id}` : undefined);

    // une vente se nomme par son numéro, comme dans la liste des ventes
    return log.entity_type === "sale" ? name?.replace(/^n° /, "#") : name;
};

const PAYMENT: Record<string, string> = { CASH: "en espèces", MOBILE_MONEY: "par Mobile Money" };

// les pages de l'API, au singulier et au pluriel
const RESOURCES: Record<string, [string, string]> = {
    categories: ["une catégorie", "les catégories"],
    products: ["un produit", "les produits"],
    suppliers: ["un fournisseur", "les fournisseurs"],
    customers: ["un client", "les clients"],
    users: ["un utilisateur", "les utilisateurs"],
    sales: ["une vente", "les ventes"],
    stock_entries: ["une entrée de stock", "les entrées de stock"],
    stock_movements: ["un mouvement de stock", "les mouvements de stock"],
    inventories: ["un inventaire", "les inventaires"],
    cash_sessions: ["la caisse", "les caisses"],
    cash_controls: ["un contrôle de caisse", "les contrôles de caisse"],
    cash_movements: ["un mouvement de caisse", "les mouvements de caisse"],
    "audit-logs": ["le journal d'audit", "le journal d'audit"],
    "low-stock-alerts": ["les alertes de stock", "les alertes de stock"],
    exports: ["un export", "les exports"],
    dashboard: ["le tableau de bord", "le tableau de bord"],
    "shop-settings": ["les informations de la boutique", "les informations de la boutique"],
    "sales-settings": ["les paramètres des ventes", "les paramètres des ventes"],
    "stock-settings": ["les paramètres du stock", "les paramètres du stock"],
    "cash-settings": ["les paramètres de la caisse", "les paramètres de la caisse"],
};

// "PATCH /categories/4/restore" devient "restaurer une catégorie"
export const describeRequest = (method: unknown, path: unknown) => {
    if (typeof method !== "string" || typeof path !== "string") return "ouvrir une page réservée";
    const [resource, id, extra] = path.split("/").filter(Boolean);
    const names = RESOURCES[resource];
    if (!names) return "ouvrir une page réservée";

    const [one, many] = names;
    if (extra === "restore") return `restaurer ${one}`;
    if (resource === "exports") return "exporter des données";
    switch (method) {
        case "GET":
            return `consulter ${id ? one : many}`;
        case "POST":
            return `créer ${one}`;
        case "DELETE":
            return `supprimer ${one}`;
        default:
            return `modifier ${one}`;
    }
};

export const getAuditSentence = (log: AuditLog): AuditSentence => {
    const d = log.details ?? {};
    const after = part(log, "after") ?? {};
    const name = objectName(log);

    switch (log.action) {
        case "AUTH_LOGIN_SUCCEEDED":
            return { verb: "s'est connecté" };
        case "AUTH_LOGOUT_ALL":
            return { verb: "s'est déconnecté de tous ses appareils" };
        case "AUTH_LOGIN_FAILED":
            return { verb: "n'a pas pu se connecter", note: "e-mail ou mot de passe incorrect" };
        case "ACCESS_DENIED":
            return {
                verb: "a essayé de",
                object: describeRequest(d["method"], d["path"]),
                note: "réservé à l'administrateur",
            };
        case "PASSWORD_CHANGED":
            return { verb: "a changé son mot de passe" };
        case "PASSWORD_CHANGE_FAILED":
            return { verb: "a saisi un mauvais mot de passe actuel" };
        case "TWO_FACTOR_ENABLED":
            return { verb: "a activé la double authentification" };
        case "TWO_FACTOR_DISABLED":
            return { verb: "a désactivé la double authentification" };
        case "TWO_FACTOR_FAILED":
            return { verb: "a saisi un code de double authentification incorrect" };
        case "PASSWORD_RESET_REQUESTED":
            return { verb: "a demandé un lien pour changer son mot de passe" };
        case "PASSWORD_RESET_COMPLETED":
            return { verb: "a choisi un nouveau mot de passe avec le lien reçu" };
        case "SHOP_ADMIN_RESET_LINK_SENT":
            return {
                verb: "a envoyé un lien de réinitialisation du mot de passe à",
                object: String(d["email"] ?? name),
            };
        case "SHOP_ADMIN_TEMP_PASSWORD_SET":
            return {
                verb: "a donné un mot de passe provisoire à",
                object: String(d["email"] ?? name),
            };
        case "PROFILE_UPDATED":
            return { verb: "a modifié son profil" };

        case "SALE_CREATED":
            return {
                verb: "a encaissé une vente de",
                object: money(d["total"]) ?? undefined,
                note: PAYMENT[String(d["paymentMethod"])],
            };
        case "SALE_PAYMENT_ADDED":
            return {
                verb: "a encaissé un paiement de",
                object: money(d["amount"]) ?? undefined,
                note: PAYMENT[String(d["paymentMethod"])],
            };
        case "SALE_ITEM_RETURNED":
            return {
                verb: "a repris un article d'une vente pour",
                object: money(d["amount"]) ?? undefined,
                note: typeof d["reason"] === "string" ? d["reason"] : undefined,
            };
        case "SALE_CANCELLED":
            return {
                verb: "a remboursé la vente",
                object: name,
                note: text(d["reason"]) ?? undefined,
            };
        case "EXPORT_CREATED":
            return { verb: "a exporté", object: EXPORT_LABELS[String(d["type"])] ?? "un fichier" };
        case "SALES_EXPORTED":
            return { verb: "a exporté les ventes" };
        case "PRODUCTS_EXPORTED":
            return { verb: "a exporté les produits" };

        case "CASH_SESSION_OPENED":
            return {
                verb: "a ouvert la caisse avec",
                object: money(d["openingAmount"]) ?? undefined,
            };
        case "CASH_SESSION_CLOSED": {
            const gap = Number(after["difference"] ?? 0);
            return {
                verb: "a clôturé la caisse",
                note: gap ? `écart de ${fcfa.transform(gap, true)}` : "sans écart",
            };
        }
        case "CASH_SESSION_GAP_EXPLAINED":
            return {
                verb: "a expliqué un écart de caisse",
                note: text(d["closingNote"]) ?? undefined,
            };
        case "CASH_SESSION_REOPENED":
            return { verb: "a rouvert la caisse", note: text(d["reason"]) ?? undefined };
        case "CASH_MOVEMENT_CREATED": {
            const amount = money(d["amount"]) ?? undefined;
            const reason = text(d["reason"]) ?? undefined;
            if (d["type"] === "DEPOSIT") return { verb: "a déposé", object: amount, note: reason };
            if (d["type"] === "EXPENSE")
                return { verb: "a payé une dépense de", object: amount, note: reason };
            return { verb: "a retiré", object: amount, note: reason };
        }

        case "STOCK_ENTRY_CREATED":
            return {
                verb: d["quantity"]
                    ? `a ajouté ${d["quantity"]} au stock de`
                    : "a ajouté du stock à",
                object: log.entity_name ?? "un produit",
            };
        case "STOCK_ADJUSTED":
            return {
                verb: d["quantity"]
                    ? `a ${d["direction"] === "gain" ? "ajouté" : "retiré"} ${d["quantity"]} ${d["direction"] === "gain" ? "au" : "du"} stock de`
                    : "a ajusté le stock de",
                object: log.entity_name ?? "un produit",
            };
        case "INVENTORY_CREATED": {
            const items = Array.isArray(d["items"]) ? d["items"].length : 0;
            return {
                verb: "a enregistré un inventaire",
                note: items
                    ? `${items} produit${items > 1 ? "s" : ""} compté${items > 1 ? "s" : ""}`
                    : undefined,
            };
        }
        case "INVENTORY_APPLIED": {
            const count = Array.isArray(d["adjustments"]) ? d["adjustments"].length : 0;
            return {
                verb: "a appliqué un inventaire au stock",
                note: count
                    ? `${count} produit${count > 1 ? "s" : ""} corrigé${count > 1 ? "s" : ""}`
                    : undefined,
            };
        }

        case "PRODUCTS_IMPORTED": {
            const count = Number(d["count"] ?? 0);
            return {
                verb: count
                    ? `a importé ${count} produit${count > 1 ? "s" : ""}`
                    : "a importé des produits",
            };
        }
        case "PRODUCT_IMAGE_UPDATED":
            return {
                verb: d["removed"]
                    ? "a retiré la photo du produit"
                    : "a changé la photo du produit",
                object: name,
            };
        case "PRODUCT_CREATED":
            return { verb: "a créé le produit", object: name };
        case "PRODUCT_UPDATED":
            return { verb: "a modifié le produit", object: name };
        case "PRODUCT_DEACTIVATED":
            return { verb: "a supprimé le produit", object: name };

        case "CATEGORY_CREATED":
            return { verb: "a créé la catégorie", object: name };
        case "CATEGORY_UPDATED":
            return { verb: "a modifié la catégorie", object: name };
        case "CATEGORY_DEACTIVATED":
            return { verb: "a supprimé la catégorie", object: name };
        case "CATEGORY_RESTORED":
            return { verb: "a restauré la catégorie", object: name };

        case "SUPPLIER_CREATED":
            return { verb: "a ajouté le fournisseur", object: name };
        case "SUPPLIER_UPDATED":
            return { verb: "a modifié le fournisseur", object: name };
        case "SUPPLIER_DEACTIVATED":
            return { verb: "a supprimé le fournisseur", object: name };
        case "SUPPLIER_RESTORED":
            return { verb: "a restauré le fournisseur", object: name };

        case "CUSTOMER_CREATED":
            return { verb: "a ajouté le client", object: name };
        case "CUSTOMER_UPDATED":
            return { verb: "a modifié le client", object: name };
        case "CUSTOMER_DEACTIVATED":
            return { verb: "a désactivé le client", object: name };
        case "CUSTOMER_RESTORED":
            return { verb: "a restauré le client", object: name };

        case "USER_CREATED":
            return { verb: "a créé le compte de", object: name };
        case "USER_UPDATED":
            return { verb: "a modifié le compte de", object: name };
        case "USER_DEACTIVATED":
            return { verb: "a supprimé le compte de", object: name };
        case "USER_RESTORED":
            return { verb: "a restauré le compte de", object: name };
        case "USER_PASSWORD_RESET":
            return { verb: "a changé le mot de passe de", object: name };

        case "SHOP_SETTINGS_UPDATED":
            return { verb: "a modifié les informations de la boutique" };
        case "SHOP_LOGO_UPDATED":
            return { verb: "a changé le logo de la boutique" };
        case "SHOP_LOGO_REMOVED":
            return { verb: "a retiré le logo de la boutique" };
        case "SALES_SETTINGS_UPDATED":
            return { verb: "a modifié les paramètres des ventes" };
        case "STOCK_SETTINGS_UPDATED":
            return { verb: "a modifié le seuil de stock bas" };
        case "CASH_SETTINGS_UPDATED":
            return { verb: "a modifié les paramètres de la caisse" };
        case "ALERT_EMAIL_SETTINGS_UPDATED": {
            const enabled = after["enabled"];
            return {
                verb: "a modifié l'e-mail des alertes",
                note: enabled === true ? "activé" : enabled === false ? "désactivé" : undefined,
            };
        }
        case "ALERT_EMAIL_TEST_SENT":
            return { verb: "a envoyé un e-mail d'essai des alertes" };

        // actions du propriétaire de Boutiki, visibles dans son propre journal
        case "SHOP_REGISTERED":
            return { verb: "a créé sa boutique", object: text(d["name"]) ?? name };
        case "SHOP_CREATED":
            return { verb: "a créé la boutique", object: text(d["name"]) ?? name };
        case "SHOP_TRIAL_CHANGED":
            return {
                verb: "a changé l'essai gratuit de",
                object: text(d["name"]) ?? name,
                note: d["trialDays"] ? `${d["trialDays"]} jours` : undefined,
            };
        case "MAIL_SETTINGS_UPDATED":
            return { verb: "a réglé l'adresse d'envoi des e-mails" };
        case "MAIL_SETTINGS_REMOVED":
            return { verb: "a retiré l'adresse d'envoi des e-mails" };
        case "MAIL_TEST_SENT":
            return { verb: "a envoyé un e-mail d'essai" };
    }

    // une action ajoutée plus tard au backend reste affichée, sans phrase inventée
    // ni code technique en majuscules
    return { verb: "a fait une action" };
};

// champs suivis dans le détail d'une modification ; les autres (dates, id) sont ignorés
const FIELDS: Record<string, string> = {
    name: "Nom",
    description: "Description",
    email: "E-mail",
    role: "Rôle",
    contact: "Contact",
    telephone: "Téléphone",
    phone: "Téléphone",
    address: "Adresse",
    tax_id: "IFU",
    rccm: "RCCM",
    receipt_footer: "Bas du ticket",
    sale_price: "Prix de vente",
    purchase_price: "Prix d'achat",
    pricing_mode: "Prix",
    max_discount: "Remise maximale",
    min_stock: "Seuil de stock bas",
    minStock: "Seuil de stock bas",
    ticketPrefix: "Préfixe des tickets",
    defaultMaxDiscount: "Remise maximale par défaut",
    blindClose: "Clôture sans voir le montant attendu",
};

const PRICES = new Set(["sale_price", "purchase_price", "max_discount", "defaultMaxDiscount"]);

const VALUES: Record<string, string> = {
    admin: "Administrateur",
    manager: "Employé",
    FIXED: "Fixe",
    NEGOTIABLE: "Négociable",
};

const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "vide";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (PRICES.has(key)) return fcfa.transform(Number(value));
    return VALUES[String(value)] ?? String(value);
};

// ce qui a changé entre avant et après, pour le détail d'une ligne
export const getAuditChanges = (log: AuditLog): AuditChange[] => {
    const before = part(log, "before");
    const after = part(log, "after");
    if (!before || !after) return [];

    return Object.keys(FIELDS)
        .filter((key) => key in after && String(before[key] ?? "") !== String(after[key] ?? ""))
        .map((key) => ({
            label: FIELDS[key],
            before: formatValue(key, before[key]),
            after: formatValue(key, after[key]),
        }));
};

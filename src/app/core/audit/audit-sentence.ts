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

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const money = (value: unknown) =>
    value === null || value === undefined ? null : fcfa.transform(Number(value));

const part = (log: AuditLog, key: "before" | "after") => {
    const value = log.details?.[key];
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

// le nom enregistré au moment de l'action, sinon le nom actuel renvoyé par l'API
const objectName = (log: AuditLog) =>
    text(part(log, "after")?.["name"]) ??
    text(log.details?.["name"]) ??
    log.entity_name ??
    (log.entity_id ? `n° ${log.entity_id}` : undefined);

const PAYMENT: Record<string, string> = { CASH: "en espèces", MOBILE_MONEY: "par mobile money" };

// les pages de l'API, au singulier et au pluriel
const RESOURCES: Record<string, [string, string]> = {
    categories: ["une catégorie", "les catégories"],
    products: ["un produit", "les produits"],
    suppliers: ["un fournisseur", "les fournisseurs"],
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
        case "AUTH_LOGIN_FAILED":
            return { verb: "n'a pas pu se connecter", note: "email ou mot de passe incorrect" };
        case "ACCESS_DENIED":
            return {
                verb: "a essayé de",
                object: describeRequest(d["method"], d["path"]),
                note: "réservé au propriétaire",
            };
        case "PASSWORD_CHANGED":
            return { verb: "a changé son mot de passe" };
        case "PASSWORD_CHANGE_FAILED":
            return { verb: "a saisi un mauvais mot de passe actuel" };
        case "PROFILE_UPDATED":
            return { verb: "a modifié son profil" };

        case "SALE_CREATED":
            return {
                verb: "a encaissé une vente de",
                object: money(d["total"]) ?? undefined,
                note: PAYMENT[String(d["paymentMethod"])],
            };
        case "SALE_CANCELLED":
            return {
                verb: "a remboursé la vente",
                object: name,
                note: text(d["reason"]) ?? undefined,
            };
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
        case "INVENTORY_CREATED": {
            const items = Array.isArray(d["items"]) ? d["items"].length : 0;
            return {
                verb: "a enregistré un inventaire",
                note: items
                    ? `${items} produit${items > 1 ? "s" : ""} compté${items > 1 ? "s" : ""}`
                    : undefined,
            };
        }

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
    }

    // une action ajoutée plus tard au backend reste affichée, sans phrase inventée
    return { verb: "a fait une action", note: log.action };
};

// champs suivis dans le détail d'une modification ; les autres (dates, id) sont ignorés
const FIELDS: Record<string, string> = {
    name: "Nom",
    description: "Description",
    email: "Email",
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
    admin: "Propriétaire",
    manager: "Gérant",
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

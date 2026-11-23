import { Inventory, InventoryStatus } from "../../core/stock/inventory.model";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import type { IconName } from "../../shared/icon/icons";

const fcfa = new FcfaPipe();

// couleur de la pastille et de la tuile de chaque statut ; bleu : la couleur de la marque
export const STATUS_TONES: Record<InventoryStatus, "primary" | "warning" | "success" | "neutral"> =
    {
        in_progress: "primary",
        counted: "warning",
        applied: "success",
        cancelled: "neutral",
    };

export const STATUS_ICONS: Record<InventoryStatus, IconName> = {
    in_progress: "clipboard",
    counted: "clock",
    applied: "check",
    cancelled: "ban",
};

const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const dayYearFormat = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

// "23 nov." ; l'année s'ajoute quand elle n'est pas l'année en cours
export const shortDate = (value: string) => {
    const date = new Date(value);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return (sameYear ? dayFormat : dayYearFormat).format(date);
};

// "23 nov. à 16:32"
export const longDate = (value: string) =>
    `${shortDate(value)} à ${timeFormat.format(new Date(value))}`;

// le nom donné à l'ouverture, sinon "Inventaire du 23 nov."
export const inventoryTitle = (inventory: Inventory) =>
    inventory.name || `Inventaire du ${shortDate(inventory.startedAt)}`;

// "perte de 45 000 F", "gain de 3 000 F" ou rien quand la valeur est nulle
const valuePhrase = (value: number | null) => {
    if (!value) return "";

    // l'espace insécable garde le « F » avec son montant à la ligne
    const amount = fcfa.transform(Math.abs(value)).replace(" F", "\u00a0F");
    return value < 0 ? `perte de ${amount}` : `gain de ${amount}`;
};

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

// Le résultat en une phrase. Le gérant ne voit jamais d'argent : il lit seulement ce qui a été compté.
// long : forme de la fiche ("12 produits en écart"), sinon forme courte de la liste ("12 écarts").
export const resultSentence = (inventory: Inventory, isAdmin: boolean, long = false) => {
    const { status, itemsCount, differenceCount, differenceValue } = inventory;

    if (status === "cancelled") return "Comptage abandonné";

    if (status === "in_progress" && itemsCount === 0) return "Aucun produit pour l'instant";

    if (status === "in_progress" || !isAdmin || differenceCount === null) {
        return `${itemsCount} ${plural(itemsCount, "produit compté", "produits comptés")}`;
    }

    if (differenceCount === 0) return "Aucun écart";

    const count = long
        ? `${differenceCount} ${plural(differenceCount, "produit en écart", "produits en écart")}`
        : `${differenceCount} ${plural(differenceCount, "écart", "écarts")}`;
    const value = valuePhrase(differenceValue);

    return value ? `${count}, ${value}` : count;
};

// un comptage ouvert ou terminé depuis plus d'un jour : le stock a pu bouger depuis
export const isOld = (inventory: Inventory) =>
    (inventory.status === "in_progress" || inventory.status === "counted") &&
    Date.now() - new Date(inventory.startedAt).getTime() > 86_400_000;

export const ageInDays = (inventory: Inventory) =>
    Math.floor((Date.now() - new Date(inventory.startedAt).getTime()) / 86_400_000);

// La phrase du haut de la fiche : ce qu'il faut retenir du comptage
export const heroSentence = (inventory: Inventory, isAdmin: boolean) => {
    if (!isAdmin && inventory.status === "counted") {
        return "Comptage terminé, en attente de validation";
    }

    if (!isAdmin && inventory.status === "applied") return "Comptage terminé, stock corrigé";

    return resultSentence(inventory, isAdmin, true);
};

// "il y a 3 jours" pour l'avertissement d'un vieux comptage
export const ageText = (inventory: Inventory) => {
    const days = ageInDays(inventory);
    return `${days} jour${days > 1 ? "s" : ""}`;
};

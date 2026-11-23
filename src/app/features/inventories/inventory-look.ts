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

// "17h09"
const timeText = (value: string) => timeFormat.format(new Date(value)).replace(":", "h");

// "23 nov. à 17h09"
export const longDate = (value: string) => `${shortDate(value)} à ${timeText(value)}`;

// le nom donné à l'ouverture, sinon la date et l'heure de début
export const inventoryTitle = (inventory: Inventory) =>
    inventory.name || longDate(inventory.startedAt);

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

// Le résultat en une phrase, sans argent. Le gérant lit seulement ce qui a été compté.
// long : forme de la fiche ("12 produits en écart"), sinon forme courte de la liste ("12 écarts").
export const resultSentence = (inventory: Inventory, isAdmin: boolean, long = false) => {
    const { status, itemsCount, differenceCount } = inventory;

    if (status === "cancelled") return "Comptage abandonné";

    if (status === "in_progress" && itemsCount === 0) return "Aucun produit pour l'instant";

    if (status === "in_progress" || !isAdmin || differenceCount === null) {
        return `${itemsCount} ${plural(itemsCount, "produit compté", "produits comptés")}`;
    }

    if (differenceCount === 0) return "Aucun écart";

    return long
        ? `${differenceCount} ${plural(differenceCount, "produit en écart", "produits en écart")}`
        : `${differenceCount} ${plural(differenceCount, "écart", "écarts")}`;
};

// La ligne de résultat d'une carte de la liste, colorée : vert pour un gain, rouge pour une perte
export const listResult = (inventory: Inventory, isAdmin: boolean) => {
    const text = resultSentence(inventory, isAdmin);
    const value = inventory.differenceValue;
    const showValue =
        isAdmin && inventory.status !== "in_progress" && !!inventory.differenceCount && !!value;

    if (!showValue) return { text, tone: "neutral" as const };

    // l'espace insécable garde le « F » avec son montant à la ligne
    const amount = fcfa.transform(value, true).replace(" F", "\u00a0F");
    return {
        text: `${text} · ${amount}`,
        tone: value! > 0 ? ("gain" as const) : ("loss" as const),
    };
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

// "3 jours" pour l'avertissement d'un vieux comptage
export const ageText = (inventory: Inventory) => {
    const days = ageInDays(inventory);
    return `${days} jour${days > 1 ? "s" : ""}`;
};

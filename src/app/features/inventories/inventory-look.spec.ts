import { Inventory } from "../../core/stock/inventory.model";
import {
    STATUS_TONES,
    heroSentence,
    inventoryTitle,
    isOld,
    resultSentence,
} from "./inventory-look";

const inventory = (changes: Partial<Inventory> = {}): Inventory => ({
    id: 12,
    name: null,
    status: "counted",
    statusLabel: "À valider",
    startedAt: new Date().toISOString(),
    countedAt: null,
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Adam", avatar: null },
    countedBy: null,
    appliedBy: null,
    cancelledBy: null,
    itemsCount: 30,
    differenceCount: 12,
    differenceValue: -45000,
    maxStock: 1000000,
    ...changes,
});

describe("inventory look", () => {
    const text = (value: string) => value.replace(/\s/g, " ");

    it("should name an inventory by its name, else by its date", () => {
        expect(inventoryTitle(inventory({ name: "Fin de mois" }))).toBe("Fin de mois");
        expect(inventoryTitle(inventory({ startedAt: "2026-11-23T10:00:00Z" }))).toMatch(
            /^23 nov\. à \d{2}h\d{2}$/,
        );
    });

    it("should give each status its colour", () => {
        expect(STATUS_TONES).toEqual({
            in_progress: "primary",
            counted: "warning",
            applied: "success",
            cancelled: "neutral",
        });
    });

    it("should tell the number of gaps to the admin, without money in the sentence", () => {
        expect(resultSentence(inventory(), true)).toBe("12 écarts");
        expect(resultSentence(inventory(), true, true)).toBe("12 produits en écart");
        expect(resultSentence(inventory({ differenceCount: 0, differenceValue: 0 }), true)).toBe(
            "Aucun écart",
        );
    });

    it("should only tell the manager how many products were counted", () => {
        const blind = inventory({ differenceCount: null, differenceValue: null, itemsCount: 12 });

        expect(resultSentence(blind, false)).toBe("12 produits comptés");
        // Même si le serveur envoyait les écarts, le gérant ne lit jamais d'argent
        expect(resultSentence(inventory(), false)).toBe("30 produits comptés");
    });

    it("should give the number of products of an open counting and a short word for a cancelled one", () => {
        expect(resultSentence(inventory({ status: "in_progress" }), true)).toBe(
            "30 produits comptés",
        );
        expect(resultSentence(inventory({ status: "in_progress", itemsCount: 1 }), true)).toBe(
            "1 produit compté",
        );
        expect(resultSentence(inventory({ status: "in_progress", itemsCount: 0 }), true)).toBe(
            "Aucun produit pour l'instant",
        );
        expect(resultSentence(inventory({ status: "cancelled" }), true)).toBe("Comptage abandonné");
    });

    it("should write the sentence at the top of the page for each role", () => {
        expect(heroSentence(inventory(), true)).toBe("12 produits en écart");
        expect(heroSentence(inventory(), false)).toBe("Comptage terminé, en attente de validation");
        expect(heroSentence(inventory({ status: "applied" }), false)).toBe(
            "Comptage terminé, stock corrigé",
        );
    });

    it("should warn about a counting older than one day, until the stock is corrected", () => {
        const old = new Date(Date.now() - 2 * 86_400_000).toISOString();

        expect(isOld(inventory({ startedAt: old }))).toBe(true);
        expect(isOld(inventory({ startedAt: old, status: "in_progress" }))).toBe(true);
        expect(isOld(inventory({ startedAt: old, status: "applied" }))).toBe(false);
        expect(isOld(inventory())).toBe(false);
    });
});

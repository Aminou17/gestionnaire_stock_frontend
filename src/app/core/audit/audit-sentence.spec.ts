import { AuditLog } from "./audit-log.model";
import { describeRequest, getAuditChanges, getAuditSentence } from "./audit-sentence";

const log = (patch: Partial<AuditLog>): AuditLog => ({
    id: 1,
    user_id: 1,
    user_name: "Awa",
    action: "PRODUCT_CREATED",
    entity_type: null,
    entity_id: null,
    details: null,
    result: "SUCCESS",
    ip_address: null,
    created_at: "2026-01-10T10:00:00Z",
    ...patch,
});

describe("audit sentence", () => {
    it("should turn a denied request into words", () => {
        expect(describeRequest("PATCH", "/categories/4/restore")).toBe("restaurer une catégorie");
        expect(describeRequest("GET", "/users")).toBe("consulter les employés");
        expect(describeRequest("DELETE", "/products/3")).toBe("supprimer un produit");
        expect(describeRequest("GET", "/inconnu")).toBe("ouvrir une page réservée");
    });

    it("should name the object, from the details or from the API", () => {
        expect(
            getAuditSentence(log({ action: "CATEGORY_CREATED", details: { name: "Tissus" } })),
        ).toEqual({ verb: "a créé la catégorie", object: "Tissus" });

        expect(
            getAuditSentence(
                log({ action: "USER_DEACTIVATED", entity_type: "user", entity_name: "Moussa" }),
            ).object,
        ).toBe("Moussa");
    });

    it("should write a sentence for each customer action", () => {
        expect(
            getAuditSentence(log({ action: "CUSTOMER_CREATED", details: { name: "Awa Kouba" } })),
        ).toEqual({ verb: "a ajouté le client", object: "Awa Kouba" });

        expect(
            getAuditSentence(
                log({
                    action: "CUSTOMER_DEACTIVATED",
                    entity_type: "customer",
                    entity_name: "Awa",
                }),
            ),
        ).toEqual({ verb: "a désactivé le client", object: "Awa" });

        expect(getAuditSentence(log({ action: "CUSTOMER_UPDATED" })).verb).toBe(
            "a modifié le client",
        );
        expect(getAuditSentence(log({ action: "CUSTOMER_RESTORED" })).verb).toBe(
            "a restauré le client",
        );
    });

    it("should give the amount and the payment of a sale", () => {
        const sentence = getAuditSentence(
            log({ action: "SALE_CREATED", details: { total: 25000, paymentMethod: "CASH" } }),
        );

        expect(sentence.object!.replace(/\s/g, " ")).toBe("25 000 F");
        expect(sentence.note).toBe("en espèces");
    });

    it("should keep an unknown action without inventing a sentence or showing its code", () => {
        expect(getAuditSentence(log({ action: "NEW_THING" }))).toEqual({
            verb: "a fait une action",
        });
    });

    it("should describe a reopened cash register with its reason", () => {
        expect(
            getAuditSentence(
                log({ action: "CASH_SESSION_REOPENED", details: { reason: "Oubli" } }),
            ),
        ).toEqual({ verb: "a rouvert la caisse", note: "Oubli" });
    });

    it("should describe a counting and a corrected counting with their gap", () => {
        const after = { difference: -500 };

        expect(
            getAuditSentence(log({ action: "CASH_SESSION_CLOSED", details: { after } })),
        ).toEqual({ verb: "a compté la caisse", note: expect.stringContaining("écart de") });
        expect(
            getAuditSentence(log({ action: "CASH_SESSION_RECOUNTED", details: { after } })).verb,
        ).toBe("a rectifié le comptage");
    });

    it("should count the products of an applied inventory", () => {
        const sentence = getAuditSentence(
            log({ action: "INVENTORY_APPLIED", details: { adjustments: [{}, {}] } }),
        );

        expect(sentence.verb).toBe("a corrigé le stock d'après un inventaire");
        expect(sentence.note).toBe("2 produits corrigés");
    });

    it("should describe the steps of a counting", () => {
        expect(getAuditSentence(log({ action: "INVENTORY_STARTED" })).verb).toBe(
            "a commencé un comptage de stock",
        );
        expect(getAuditSentence(log({ action: "INVENTORY_COUNTED" })).verb).toBe(
            "a terminé un comptage de stock",
        );
        expect(getAuditSentence(log({ action: "INVENTORY_CANCELLED" })).verb).toBe(
            "a annulé un inventaire",
        );
    });

    it("should tell an imported batch of products", () => {
        expect(
            getAuditSentence(log({ action: "PRODUCTS_IMPORTED", details: { count: 12 } })).verb,
        ).toBe("a importé 12 produits");
    });

    it("should list only the known fields that changed", () => {
        const changes = getAuditChanges(
            log({
                details: {
                    before: { name: "Tissus", role: "manager", updated_at: "a" },
                    after: { name: "Tissus", role: "admin", updated_at: "b" },
                },
            }),
        );

        expect(changes).toEqual([{ label: "Rôle", before: "Employé", after: "Administrateur" }]);
    });
});

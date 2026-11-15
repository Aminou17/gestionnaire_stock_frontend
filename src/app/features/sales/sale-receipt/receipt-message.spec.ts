import { SaleDetail } from "../../../core/sales/sale.model";
import { receiptLink, receiptMessage } from "./receipt-message";

const sale = (changes: Partial<SaleDetail> = {}) =>
    ({
        id: 9,
        number: 128,
        total: 35000,
        paid_amount: 20000,
        status: "ACTIVE",
        created_at: "2026-11-14T10:30:00Z",
        customer_phone: "06 612 34 56",
        items: [
            { id: 1, product_name: "Pagne wax", quantity: 2, unit_price: 10000 },
            { id: 2, product_name: "Sac", quantity: 1, unit_price: 15000 },
        ],
        ...changes,
    }) as SaleDetail;

describe("receipt message", () => {
    it("should list the items, the total and the amount left to pay", () => {
        const message = receiptMessage(sale(), "Awa Bazin", "AB");

        expect(message).toContain("Awa Bazin");
        expect(message).toContain("Ticket n° AB-000128");
        expect(message).toContain("2 x Pagne wax : 20 000 F");
        expect(message).toContain("Total : 35 000 F");
        expect(message).toContain("Reste à payer : 15 000 F");
    });

    it("should not show a rest to pay on a fully paid sale", () => {
        const message = receiptMessage(sale({ paid_amount: 35000 }), "Awa Bazin");

        expect(message).toContain("Payé : 35 000 F");
        expect(message).not.toContain("Reste à payer");
    });

    it("should add the shop announcement before the thanks", () => {
        const message = receiptMessage(sale(), "Awa Bazin", "", "Fermé lundi");

        expect(message).toContain("Fermé lundi");
        expect(message.indexOf("Fermé lundi")).toBeLessThan(message.indexOf("Merci"));
    });

    it("should say when the sale is refunded", () => {
        const message = receiptMessage(sale({ status: "CANCELLED" }), "Awa Bazin");

        expect(message).toContain("Vente remboursée");
        expect(message).not.toContain("Reste à payer");
    });

    it("should write to the customer when there is a phone number", () => {
        expect(receiptLink(sale(), "Awa Bazin", "242")).toMatch(/^https:\/\/wa\.me\/242\d+\?text=/);
        expect(receiptLink(sale({ customer_phone: "66 09 90 60" }), "Awa Bazin", "226")).toMatch(
            /^https:\/\/wa\.me\/22666099060\?text=/,
        );
    });

    it("should let WhatsApp pick the chat without a phone number", () => {
        expect(receiptLink(sale({ customer_phone: null }), "Awa Bazin", "242")).toMatch(
            /^https:\/\/wa\.me\/\?text=/,
        );
    });
});

import { SaleDetail } from "../../../core/sales/sale.model";
import { receiptLink, ticketLinkLink, ticketLinkMessage, receiptMessage } from "./receipt-message";

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
        const message = receiptMessage(sale(), "Adam Ouédraogo", "AB");

        expect(message).toContain("Adam Ouédraogo");
        expect(message).toContain("Ticket n° AB-000128");
        expect(message).toContain("2 x Pagne wax : 20 000 F");
        expect(message).toContain("Total : 35 000 F");
        expect(message).toContain("Reste à payer : 15 000 F");
    });

    it("should not show a rest to pay on a fully paid sale", () => {
        const message = receiptMessage(sale({ paid_amount: 35000 }), "Adam Ouédraogo");

        expect(message).toContain("Payé : 35 000 F");
        expect(message).not.toContain("Reste à payer");
    });

    it("should end with the footer written by the shop, and nothing of its own", () => {
        const message = receiptMessage(sale(), "Adam Ouédraogo", "", "Fermé lundi");

        expect(message.endsWith("Fermé lundi")).toBe(true);
        expect(message).not.toContain("Merci");
        expect(receiptMessage(sale(), "Adam Ouédraogo")).not.toContain("Merci");
    });

    it("should say when the sale is refunded", () => {
        const message = receiptMessage(sale({ status: "CANCELLED" }), "Adam Ouédraogo");

        expect(message).toContain("Vente remboursée");
        expect(message).not.toContain("Reste à payer");
    });

    it("should write to the customer when there is a phone number", () => {
        expect(receiptLink(sale(), "Adam Ouédraogo", "242")).toMatch(/^https:\/\/wa\.me\/242\d+\?text=/);
        expect(receiptLink(sale({ customer_phone: "66 09 90 60" }), "Adam Ouédraogo", "226")).toMatch(
            /^https:\/\/wa\.me\/22666099060\?text=/,
        );
    });

    it("should let WhatsApp pick the chat without a phone number", () => {
        expect(receiptLink(sale({ customer_phone: null }), "Adam Ouédraogo", "242")).toMatch(
            /^https:\/\/wa\.me\/\?text=/,
        );
    });

    it("should open the customer chat with only the ticket address", () => {
        const url = "https://api.exemple.test/t/9.abc";
        const link = ticketLinkLink(sale({ customer_phone: "66 09 90 60" }), "226", url);

        expect(link).toMatch(/^https:\/\/wa\.me\/22666099060\?text=/);
        expect(decodeURIComponent(link.split("text=")[1])).toBe(url);
        expect(ticketLinkMessage(url)).toBe(url);
    });
});

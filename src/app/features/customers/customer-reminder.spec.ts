import { Customer } from "../../core/customers/customer.model";
import { reminderLink, reminderMessage } from "./customer-reminder";

const customer = (changes: Partial<Customer> = {}): Customer => ({
    id: 1,
    name: "Awa Kouba",
    phone: "06 612 34 56",
    note: null,
    is_active: true,
    created_at: "2026-11-01T10:00:00Z",
    purchases_count: 2,
    total_spent: 13000,
    due_amount: 6500,
    last_purchase_at: "2026-11-13T10:30:00Z",
    ...changes,
});

describe("customer reminder", () => {
    it("should greet the first name and give the amount due", () => {
        const message = reminderMessage(customer(), "Awa Bazin");

        expect(message).toContain("Bonjour Awa,");
        expect(message).toContain("de la boutique Awa Bazin");
        expect(message).toContain("6 500 F");
    });

    it("should build a WhatsApp link with the message", () => {
        const link = reminderLink(customer(), "Awa Bazin", "242");

        expect(link).toMatch(/^https:\/\/wa\.me\/242066123456\?text=/);
        expect(decodeURIComponent(link!)).toContain("6 500 F");
    });

    it("should give no link without a phone or without anything to pay", () => {
        expect(reminderLink(customer({ phone: null }), "Boutique")).toBeNull();
        expect(reminderLink(customer({ due_amount: 0 }), "Boutique")).toBeNull();
    });

    it("should not name a shop when the name is empty", () => {
        expect(reminderMessage(customer(), "")).toContain("c'est de la boutique. ");
    });

    it("should use the whole name when it has a single word", () => {
        expect(reminderMessage(customer({ name: "  Awa  " }), "Boutique")).toContain(
            "Bonjour Awa,",
        );
    });

    it("should give no link for a negative amount due", () => {
        expect(reminderLink(customer({ due_amount: -100 }), "Boutique")).toBeNull();
    });
});

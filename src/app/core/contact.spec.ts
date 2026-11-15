import { CONTACT, mailtoLink, whatsappLink } from "./contact";

describe("contact", () => {
    it("construit le lien mailto", () => {
        expect(mailtoLink()).toBe(`mailto:${CONTACT.email}`);
    });

    it("construit le lien WhatsApp avec le message prérempli encodé", () => {
        const link = whatsappLink();

        expect(link.startsWith("https://wa.me/22664725464?text=")).toBe(true);
        expect(decodeURIComponent(link.split("text=")[1])).toBe(CONTACT.whatsappMessage);
    });

    it("garde uniquement des chiffres pour wa.me", () => {
        expect(CONTACT.whatsappDigits).toMatch(/^\d+$/);
    });
});

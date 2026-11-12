import { formatPhone, toTelLink, toWhatsAppLink } from "./phone";

describe("phone", () => {
    it("should format a Congo number", () => {
        expect(formatPhone("061234567")).toBe("06 123 45 67");
        expect(formatPhone("+242 061234567")).toBe("06 123 45 67");
    });

    it("should group an 8 digit number by pairs", () => {
        expect(formatPhone("70123456")).toBe("70 12 34 56");
    });

    it("should keep any other number as typed", () => {
        expect(formatPhone("+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
    });

    it("should add the Congo code to call and WhatsApp links", () => {
        expect(toTelLink("06 123 45 67")).toBe("tel:+242061234567");
        expect(toWhatsAppLink("06 123 45 67")).toBe("https://wa.me/242061234567");
    });

    it("should keep a number that already has its country code", () => {
        expect(toTelLink("+33 6 12 34 56 78")).toBe("tel:+33612345678");
        expect(toWhatsAppLink("+242 06 123 45 67")).toBe("https://wa.me/242061234567");
    });
});

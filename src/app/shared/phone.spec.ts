import {
    formatPhone,
    groupNational,
    normalizePhone,
    phoneKey,
    splitPhone,
    toInternational,
    toTelLink,
    toWhatsAppLink,
} from "./phone";

describe("phone", () => {
    it("should format a Congo number", () => {
        expect(formatPhone("061234567", "242")).toBe("06 123 45 67");
        expect(formatPhone("+242 061234567", "242")).toBe("06 123 45 67");
    });

    it("should group an 8 digit number by pairs", () => {
        expect(formatPhone("70123456", "242")).toBe("70 12 34 56");
        expect(formatPhone("+226 66099060", "226")).toBe("66 09 90 60");
    });

    it("should keep the number of another country as typed", () => {
        expect(formatPhone("+33 6 12 34 56 78", "242")).toBe("+33 6 12 34 56 78");
        expect(formatPhone("+226 66 09 90 60", "242")).toBe("+226 66 09 90 60");
    });

    it("should add the shop country code to call and WhatsApp links", () => {
        expect(toTelLink("06 123 45 67", "242")).toBe("tel:+242061234567");
        expect(toWhatsAppLink("06 123 45 67", "242")).toBe("https://wa.me/242061234567");
        expect(toWhatsAppLink("66 09 90 60", "226")).toBe("https://wa.me/22666099060");
    });

    it("should keep a number that already has its country code", () => {
        expect(toTelLink("+33 6 12 34 56 78", "226")).toBe("tel:+33612345678");
        expect(toWhatsAppLink("+242 06 123 45 67", "226")).toBe("https://wa.me/242061234567");
        expect(toWhatsAppLink("00226 66 09 90 60", "242")).toBe("https://wa.me/22666099060");
    });

    it("should not add the code twice to a long number that starts with it", () => {
        expect(toWhatsAppLink("22666099060", "226")).toBe("https://wa.me/22666099060");
    });
});

describe("toWhatsAppLink with a message", () => {
    it("should add the encoded message to the link", () => {
        expect(toWhatsAppLink("06 612 34 56", "242", "Bonjour & merci")).toBe(
            "https://wa.me/242066123456?text=Bonjour%20%26%20merci",
        );
    });
});

describe("splitPhone", () => {
    it("should use the shop code for a number without +", () => {
        expect(splitPhone("66 09 90 60", "226")).toEqual({ code: "226", national: "66099060" });
    });

    it("should recognize the country of an international number", () => {
        expect(splitPhone("+226 66 09 90 60", "242")).toEqual({
            code: "226",
            national: "66099060",
        });
        expect(splitPhone("+33 6 12 34 56 78", "242")).toEqual({
            code: "33",
            national: "612345678",
        });
    });
});

describe("international format", () => {
    it("should group the national digits", () => {
        expect(groupNational("66099060")).toBe("66 09 90 60");
        expect(groupNational("061234567")).toBe("06 123 45 67");
        expect(groupNational("612345678")).toBe("6 12 34 56 78");
    });

    it("should write the number with + and the code, or nothing without digits", () => {
        expect(toInternational("226", "66099060")).toBe("+226 66 09 90 60");
        expect(toInternational("226", "  ")).toBe("");
    });

    it("should normalize a number typed freely", () => {
        expect(normalizePhone("66099060", "226")).toBe("+226 66 09 90 60");
        expect(normalizePhone("+242 061234567", "226")).toBe("+242 06 123 45 67");
    });

    it("should give the same key with and without the shop code", () => {
        expect(phoneKey("66 09 90 60", "226")).toBe(phoneKey("+226 66 09 90 60", "226"));
        expect(phoneKey("+242 66 09 90 60", "226")).not.toBe(phoneKey("66 09 90 60", "226"));
        expect(phoneKey("", "226")).toBe("");
    });
});

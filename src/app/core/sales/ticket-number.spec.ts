import { formatTicketNumber } from "./ticket-number";

describe("formatTicketNumber", () => {
    it("should pad the sale id to 6 digits", () => {
        expect(formatTicketNumber(9)).toBe("000009");
    });

    it("should put the prefix and a dash in front", () => {
        expect(formatTicketNumber(12, "AB")).toBe("AB-000012");
    });

    it("should not add a dash without prefix", () => {
        expect(formatTicketNumber(12, "")).toBe("000012");
    });
});

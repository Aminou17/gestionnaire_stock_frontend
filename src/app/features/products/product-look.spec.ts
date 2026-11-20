import { productInitials } from "./product-look";

describe("productInitials", () => {
    it("should skip the small words", () => {
        expect(productInitials("Savon de Marseille")).toBe("SM");
        expect(productInitials("Huile d'arachide")).toBe("HA");
        expect(productInitials("Pagne wax 6 yards")).toBe("PW");
    });

    it("should use the first two letters of a single word", () => {
        expect(productInitials("Riz")).toBe("RI");
        expect(productInitials("Le Bazin")).toBe("BA");
    });
});

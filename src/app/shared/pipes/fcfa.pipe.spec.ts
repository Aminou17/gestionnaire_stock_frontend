import { FcfaPipe } from "./fcfa.pipe";

describe("FcfaPipe", () => {
    const pipe = new FcfaPipe();
    // Intl utilise une espace insécable fine comme séparateur de milliers
    const clean = (value: string) => value.replace(/\s/g, " ");

    it("should format amounts with a thousands separator", () => {
        expect(clean(pipe.transform(245500))).toBe("245 500 F");
        expect(clean(pipe.transform(0))).toBe("0 F");
    });

    it("should prefix negative amounts with a minus sign", () => {
        expect(clean(pipe.transform(-12500))).toBe("−12 500 F");
    });

    it("should add a plus sign when signed is true", () => {
        expect(clean(pipe.transform(18500, true))).toBe("+18 500 F");
    });

    it("should show a dash when there is no value", () => {
        expect(pipe.transform(null)).toBe("—");
        expect(pipe.transform(undefined)).toBe("—");
    });
});

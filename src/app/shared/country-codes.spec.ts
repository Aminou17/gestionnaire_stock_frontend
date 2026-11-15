import { COUNTRY_NAMES, countryName } from "./country-codes";

describe("country codes", () => {
    it("should give the country of a known code", () => {
        expect(countryName("226")).toBe("Burkina Faso");
        expect(countryName("33")).toBe("France");
    });

    it("should give nothing for an unknown or empty code", () => {
        expect(countryName("999")).toBeNull();
        expect(countryName("")).toBeNull();
    });

    it("should only list codes of 1 to 3 digits without a leading zero", () => {
        for (const code of Object.keys(COUNTRY_NAMES)) {
            expect(code).toMatch(/^[1-9][0-9]{0,2}$/);
        }
    });
});

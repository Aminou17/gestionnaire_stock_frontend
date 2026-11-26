import { joinName, splitName } from "./person-name";

describe("person name", () => {
    it("should split at the last space", () => {
        expect(splitName("Mohamed-Haminou YABRE")).toEqual({
            firstName: "Mohamed-Haminou",
            lastName: "YABRE",
        });
        expect(splitName(" Jean  Marc Bakala ")).toEqual({
            firstName: "Jean Marc",
            lastName: "Bakala",
        });
    });

    it("should keep a name without space as first name", () => {
        expect(splitName("Fatou")).toEqual({ firstName: "Fatou", lastName: "" });
    });

    it("should join without extra space", () => {
        expect(joinName("Adam", "Ouédraogo")).toBe("Adam Ouédraogo");
        expect(joinName(" Adam ", "")).toBe("Adam");
    });
});

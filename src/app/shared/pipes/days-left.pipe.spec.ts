import { DaysLeftPipe } from "./days-left.pipe";

describe("DaysLeftPipe", () => {
    const pipe = new DaysLeftPipe();

    it("should show the number of days up to one year", () => {
        expect(pipe.transform(0)).toBe("0 j");
        expect(pipe.transform(43)).toBe("43 j");
        expect(pipe.transform(365)).toBe("365 j");
    });

    it("should not show absurd numbers beyond one year", () => {
        expect(pipe.transform(366)).toBe("plus d'un an");
        expect(pipe.transform(1530)).toBe("plus d'un an");
    });

    it("should say there is no sale when the duration is unknown", () => {
        expect(pipe.transform(null)).toBe("Pas de vente");
    });
});

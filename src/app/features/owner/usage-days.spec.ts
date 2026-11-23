import { barHeight, lastDays } from "./usage-days";

describe("usage days", () => {
    const today = new Date(2026, 10, 23, 14, 0);

    it("should list the last days, oldest first, with zero for a day without activity", () => {
        const days = lastDays(
            [{ shop_id: 1, day: "2026-11-22", views: 9, employee_views: null }],
            3,
            today,
        );

        expect(days.map((d) => d.day)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
        expect(days.map((d) => d.views)).toEqual([0, 9, 0]);
    });

    it("should cross a month change", () => {
        const days = lastDays([], 3, new Date(2026, 11, 1));

        expect(days.map((d) => d.day)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    });

    it("should size a bar against the busiest day, with a visible minimum", () => {
        expect(barHeight(50, 100)).toBe(50);
        expect(barHeight(100, 100)).toBe(100);
        expect(barHeight(1, 1000)).toBe(8);
        expect(barHeight(0, 100)).toBe(0);
        expect(barHeight(5, 0)).toBe(0);
    });
});

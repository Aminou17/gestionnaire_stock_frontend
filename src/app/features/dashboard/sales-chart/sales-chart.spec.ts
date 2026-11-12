import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SalesChart } from "./sales-chart";
import { DailySales } from "../dashboard.model";

const day = (date: string, netTotal: number, salesCount = 1): DailySales => ({
    date,
    salesTotal: netTotal,
    salesCount,
    cancellationsTotal: 0,
    cancellationsCount: 0,
    netTotal,
});

describe("SalesChart", () => {
    let fixture: ComponentFixture<SalesChart>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SalesChart] }).compileComponents();
        fixture = TestBed.createComponent(SalesChart);
        el = fixture.nativeElement;
    });

    it("should draw one bar per day and highlight today", async () => {
        fixture.componentRef.setInput("days", [
            day("2026-11-09", 100000),
            day("2026-11-10", 50000),
            day("2026-11-11", 200000),
        ]);
        await fixture.whenStable();

        const bars = el.querySelectorAll<HTMLElement>(".bar");
        expect(bars.length).toBe(3);
        expect(bars[2].classList).toContain("today");
        expect(bars[2].style.height).toBe("100%");
        expect(bars[1].style.height).toBe("25%");
        expect(el.querySelector(".day.today")?.textContent).toBe("Auj.");
    });

    it("should label values in thousands and sum the net total", async () => {
        fixture.componentRef.setInput("days", [
            day("2026-11-10", 198000),
            day("2026-11-11", 246000),
        ]);
        await fixture.whenStable();

        const values = [...el.querySelectorAll(".bar-value")].map((v) => v.textContent);
        expect(values).toEqual(["198k", "246k"]);
        expect(el.querySelector(".total")?.textContent?.replace(/\s/g, " ")).toContain("444 000 F");
    });

    it("should show an empty message when there was no sale", async () => {
        fixture.componentRef.setInput("days", [day("2026-11-10", 0, 0), day("2026-11-11", 0, 0)]);
        await fixture.whenStable();

        expect(el.textContent).toContain("Aucune vente sur les 7 derniers jours.");
    });
});

import { provideHttpClient } from "@angular/common/http";
import { registerLocaleData } from "@angular/common";
import localeFr from "@angular/common/locales/fr";
import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { OwnerShopService } from "../owner-shop.service";
import { MarginsPanel } from "./margins-panel";

registerLocaleData(localeFr);

const row = (id: number, name: string, sales: number, revenue: number, margin: number) => ({
    shop_id: id,
    name,
    sales_count: sales,
    revenue,
    cost: revenue - margin,
    margin,
    margin_rate: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : null,
});

describe("MarginsPanel", () => {
    let getMargins: ReturnType<typeof vi.fn>;

    const render = async (
        rows = [
            row(1, "Alpha", 40, 400000, 100000),
            row(2, "Beta", 20, 200000, 40000),
            row(3, "Gamma", 0, 0, 0),
        ],
    ) => {
        getMargins = vi.fn((days: number) => of({ days, rows }));
        await TestBed.configureTestingModule({
            imports: [MarginsPanel],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                { provide: LOCALE_ID, useValue: "fr" },
                { provide: OwnerShopService, useValue: { getMargins } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(MarginsPanel);
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
    };

    it("should list only the shops that sold, with their margin and rate", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelectorAll(".row").length).toBe(2);
        const text = el.textContent!.replace(/\s/g, " ");
        expect(text).toContain("100 000 F");
        expect(text).toContain("25 %");
        expect(text).not.toContain("Gamma");
    });

    it("should suggest monthly prices from the middle shop's margin", async () => {
        const fixture = await render();

        // marge de 100 000 et 40 000 : la médiane est 70 000 sur 30 jours ; 1 % = 700 F, 5 % = 3 500 F
        expect(fixture.componentInstance.monthlyMedian()).toBe(70000);
        expect(fixture.componentInstance.hints().map((h) => h.amount)).toEqual([
            700, 1400, 2100, 3500,
        ]);
    });

    it("should bring a 90 day period back to a month for the suggestions", async () => {
        const fixture = await render();
        fixture.componentInstance.select(90);
        await fixture.whenStable();

        expect(getMargins).toHaveBeenLastCalledWith(90);
        expect(fixture.componentInstance.monthlyMedian()).toBe(23333);
    });

    it("should say so when nothing was sold", async () => {
        const fixture = await render([row(1, "Alpha", 0, 0, 0)]);

        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
            "Aucune vente sur cette période",
        );
        expect(fixture.componentInstance.hints().every((h) => h.amount === 0)).toBe(true);
    });
});

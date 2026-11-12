import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { StockAlerts } from "./stock-alerts";

describe("StockAlerts", () => {
    let fixture: ComponentFixture<StockAlerts>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StockAlerts],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(StockAlerts);
        el = fixture.nativeElement;
    });

    it("should flag an empty stock as Rupture and the others as Stock faible", async () => {
        fixture.componentRef.setInput("alerts", [
            { id: 1, name: "Bazin riche", theoretical_stock: 0, min_stock: 5 },
            { id: 2, name: "Bazin getzner", theoretical_stock: 1, min_stock: 5 },
            { id: 3, name: "Bazin brodé", theoretical_stock: 3, min_stock: 5 },
        ]);
        await fixture.whenStable();

        const badges = [...el.querySelectorAll(".badge")].map((b) => b.textContent?.trim());
        expect(badges).toEqual(["Rupture", "Stock faible", "Stock faible"]);

        const details = [...el.querySelectorAll("small")].map((d) => d.textContent?.trim());
        expect(details).toEqual([
            "0 en stock · seuil 5",
            "1 en stock · seuil 5",
            "3 en stock · seuil 5",
        ]);
    });

    it("should show at most 5 products", async () => {
        const alerts = Array.from({ length: 8 }, (_, i) => ({
            id: i,
            name: `P${i}`,
            theoretical_stock: 1,
            min_stock: 5,
        }));
        fixture.componentRef.setInput("alerts", alerts);
        await fixture.whenStable();

        expect(el.querySelectorAll("li").length).toBe(5);
    });

    it("should show an empty message when there is no alert", async () => {
        await fixture.whenStable();
        expect(el.textContent).toContain("Aucun produit sous le seuil minimum.");
    });
});

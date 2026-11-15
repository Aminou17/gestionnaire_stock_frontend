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

    it("should flag an empty stock as Rupture and the others as Faible", async () => {
        fixture.componentRef.setInput("alerts", [
            {
                id: 1,
                name: "Bazin riche",
                theoretical_stock: 0,
                min_stock: 5,
                sold_last_30_days: 0,
                days_left: null,
                category_id: null,
                category_name: null,
                supplier_id: null,
                supplier_name: null,
                supplier_contact: null,
                supplier_phone: null,
                last_entry_at: null,
                last_entry_quantity: null,
                status: "OUT_OF_STOCK",
            },
            {
                id: 2,
                name: "Bazin getzner",
                theoretical_stock: 1,
                min_stock: 5,
                sold_last_30_days: 0,
                days_left: null,
                category_id: null,
                category_name: null,
                supplier_id: null,
                supplier_name: null,
                supplier_contact: null,
                supplier_phone: null,
                last_entry_at: null,
                last_entry_quantity: null,
                status: "LOW",
            },
            {
                id: 3,
                name: "Bazin brodé",
                theoretical_stock: 3,
                min_stock: 5,
                sold_last_30_days: 0,
                days_left: null,
                category_id: null,
                category_name: null,
                supplier_id: null,
                supplier_name: null,
                supplier_contact: null,
                supplier_phone: null,
                last_entry_at: null,
                last_entry_quantity: null,
                status: "LOW",
            },
        ]);
        await fixture.whenStable();

        const badges = [...el.querySelectorAll(".badge")].map((b) => b.textContent?.trim());
        expect(badges).toEqual(["Rupture", "Faible", "Faible"]);

        const details = [...el.querySelectorAll("small")].map((d) => d.textContent?.trim());
        expect(details).toEqual(["Seuil : 5", "Seuil : 5", "Seuil : 5"]);
    });

    it("should show at most 5 products", async () => {
        const alerts = Array.from({ length: 8 }, (_, i) => ({
            id: i,
            name: `P${i}`,
            theoretical_stock: 1,
            min_stock: 5,
            sold_last_30_days: 0,
            days_left: null,
            category_id: null,
            category_name: null,
            supplier_id: null,
            supplier_name: null,
            supplier_contact: null,
            supplier_phone: null,
            last_entry_at: null,
            last_entry_quantity: null,
            status: "LOW",
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

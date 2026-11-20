import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { RecentSales } from "./recent-sales";
import { Sale } from "../../../core/sales/sale.model";

const sale = (overrides: Partial<Sale>): Sale => ({
    id: 1,
    number: 101,
    user_id: 1,
    user_name: "Yabre M.",
    user_role: "admin",
    total: 18500,
    paid_amount: 18500,
    status: "ACTIVE",
    items_count: 3,
    created_at: new Date().toISOString(),
    cancelled_at: null,
    ...overrides,
});

describe("RecentSales", () => {
    let fixture: ComponentFixture<RecentSales>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RecentSales],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(RecentSales);
        el = fixture.nativeElement;
    });

    it("should not show the seller name, to keep the card light", async () => {
        fixture.componentRef.setInput("sales", [sale({ id: 1, user_name: "Yabre M." })]);
        await fixture.whenStable();

        expect(el.textContent).not.toContain("Yabre M.");
    });

    it("should link each sale to its detail page and pluralise the articles", async () => {
        fixture.componentRef.setInput("sales", [
            sale({ id: 7, items_count: 1 }),
            sale({ id: 8, items_count: 3 }),
        ]);
        await fixture.whenStable();

        const rows = [...el.querySelectorAll<HTMLAnchorElement>("a.row")];
        expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/sales/7", "/sales/8"]);
        expect(rows[0].textContent).toContain("1 article");
        expect(rows[0].textContent).not.toContain("1 articles");
        expect(rows[1].textContent).toContain("3 articles");
    });

    it("should label cancelled sales as refunded", async () => {
        fixture.componentRef.setInput("sales", [sale({ status: "CANCELLED" })]);
        await fixture.whenStable();

        expect(el.querySelector(".badge")?.textContent?.trim()).toBe("Remboursée");
        expect(el.querySelector(".amount.cancelled")).not.toBeNull();
    });
});

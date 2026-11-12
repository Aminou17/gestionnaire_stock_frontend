import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { RecentSales } from "./recent-sales";
import { Sale } from "../../../core/sales/sale.model";

const sale = (overrides: Partial<Sale>): Sale => ({
    id: 1,
    user_id: 1,
    user_name: "Yabre M.",
    user_role: "admin",
    total: 18500,
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

    const sellers = () =>
        [...el.querySelectorAll("td.seller")].map((td) =>
            td.textContent?.replace(/\s+/g, " ").trim(),
        );

    it("should show Propriétaire for an admin and Gérant for a manager", async () => {
        fixture.componentRef.setInput("sales", [
            sale({ id: 1, user_name: "Yabre M.", user_role: "admin" }),
            sale({ id: 2, user_name: "Awa", user_role: "manager" }),
        ]);
        await fixture.whenStable();

        expect(sellers()).toEqual(["Yabre M. (Propriétaire)", "Awa (Gérant)"]);
    });

    // c'était le bug : sans rôle, l'admin s'affichait "Gérant(e)"
    it("should show only the name when the role is missing", async () => {
        fixture.componentRef.setInput("sales", [sale({ user_role: undefined as any })]);
        await fixture.whenStable();

        expect(sellers()).toEqual(["Yabre M."]);
    });

    it("should label cancelled sales as refunded", async () => {
        fixture.componentRef.setInput("sales", [sale({ status: "CANCELLED" })]);
        await fixture.whenStable();

        expect(el.querySelector(".badge")?.textContent?.trim()).toBe("Remboursée");
    });
});

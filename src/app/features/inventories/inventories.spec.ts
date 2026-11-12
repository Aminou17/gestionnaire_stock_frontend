import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Inventories } from "./inventories";
import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const inventory: Inventory = {
    id: 10,
    user_id: 1,
    user_name: "Awa Bazin",
    created_at: "2026-11-12T15:00:00",
    applied_at: null,
    applied_by_name: null,
    items_count: 4,
    difference_value: -27600,
};

describe("Inventories", () => {
    let fixture: ComponentFixture<Inventories>;
    let el: HTMLElement;

    async function render(getInventories: () => unknown) {
        await TestBed.configureTestingModule({
            imports: [Inventories],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { getInventories } },
                { provide: LowStockAlertService, useValue: { count: () => 0 } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Inventories);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should show who did the inventory and the value of the gap", async () => {
        await render(() => of([inventory]));

        expect(el.textContent).toContain("Awa Bazin");
        // Intl met des espaces insécables dans les milliers
        expect(el.textContent?.replace(/\s/g, " ")).toContain("−27 600 F");
        expect(el.querySelector("a.inventory-link")?.getAttribute("href")).toBe("/inventories/10");
    });

    it("should tell which inventories already corrected the stock", async () => {
        await render(() =>
            of([inventory, { ...inventory, id: 9, applied_at: "2026-11-12T16:00:00" }]),
        );

        expect(el.querySelectorAll("tbody .badge-success").length).toBe(1);
        expect(el.querySelectorAll("tbody .badge-neutral").length).toBe(1);
    });

    it("should say when there is no inventory yet", async () => {
        await render(() => of([]));

        expect(el.textContent).toContain("Aucun inventaire n'a encore été fait.");
    });

    it("should offer to retry when the loading fails", async () => {
        await render(() => throwError(() => new Error("boom")));

        expect(el.textContent).toContain("Impossible de charger les inventaires.");
        expect(el.textContent).toContain("Réessayer");
    });
});

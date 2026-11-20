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

    async function render(getInventories: () => unknown, exportFile = vi.fn()) {
        await TestBed.configureTestingModule({
            imports: [Inventories],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { getInventories, exportFile } },
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
        expect(el.textContent).toContain("Inventaire #10");
    });

    it("should export the list in the chosen format", async () => {
        const exportFile = vi.fn(() => of(new Blob(["x"])));
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        await render(() => of([inventory]), exportFile);

        fixture.componentInstance.exportFile("csv");

        expect(exportFile).toHaveBeenCalledWith("csv");
        expect(fixture.componentInstance.exporting()).toBe(false);
        expect(el.querySelector("app-export-menu")).not.toBeNull();
    });

    it("should show an error when the export fails", async () => {
        const exportFile = vi.fn(() => throwError(() => new Error("500")));
        await render(() => of([inventory]), exportFile);

        fixture.componentInstance.exportFile("pdf");
        fixture.detectChanges();

        expect(el.querySelector(".alert")?.textContent).toContain("Impossible d'exporter");
    });

    it("should tell which inventories already corrected the stock", async () => {
        await render(() =>
            of([inventory, { ...inventory, id: 9, applied_at: "2026-11-12T16:00:00" }]),
        );

        expect(el.querySelectorAll("tbody .badge-success").length).toBe(1);
        expect(el.querySelector("tbody .badge-success")?.textContent).toContain("Appliqué");
        expect(el.querySelectorAll("tbody .badge-warning").length).toBe(1);
        expect(el.querySelector("tbody .badge-warning")?.textContent).toContain("À appliquer");
    });

    it("should remind the inventories still to apply and open the oldest", async () => {
        await render(() =>
            of([
                inventory,
                { ...inventory, id: 7, created_at: "2026-11-10T09:00:00" },
                { ...inventory, id: 9, applied_at: "2026-11-12T16:00:00" },
            ]),
        );

        const reminder = el.querySelector(".pending")!;
        expect(reminder.textContent?.replace(/\s+/g, " ")).toContain(
            "2 inventaires attendent d'être appliqués",
        );
        expect(reminder.querySelector("a")?.getAttribute("href")).toBe("/inventories/7");
    });

    it("should not remind anything when every inventory is applied", async () => {
        await render(() => of([{ ...inventory, applied_at: "2026-11-12T16:00:00" }]));
        expect(el.querySelector(".pending")).toBeNull();
    });

    it("should say when there is no inventory yet", async () => {
        await render(() => of([]));

        expect(el.textContent).toContain("Aucun inventaire pour le moment");
        expect(el.textContent).toContain("Nouvel inventaire");
    });

    it("should offer to retry when the loading fails", async () => {
        await render(() => throwError(() => new Error("boom")));

        expect(el.textContent).toContain("Impossible de charger les inventaires.");
        expect(el.textContent).toContain("Réessayer");
    });
});

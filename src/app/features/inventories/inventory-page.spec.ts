import { HttpErrorResponse } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { InventoryPage } from "./inventory-page";
import { InventoryDetail } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const detail: InventoryDetail = {
    id: 10,
    user_id: 1,
    user_name: "Awa Bazin",
    created_at: "2026-11-12T15:00:00",
    applied_at: null,
    applied_by_name: null,
    items_count: 2,
    difference_value: -27600,
    items: [
        {
            id: 1,
            product_id: 3,
            product_name: "Riz parfumé 1 kg",
            theoretical_stock: 28,
            actual_stock: 26,
            difference: -2,
            purchase_price: 2500,
            image: "data:image/webp;base64,AAA",
        },
        {
            id: 2,
            product_id: 13,
            product_name: "Bazin riche Getzner qualité 1 (5 m)",
            theoretical_stock: 14,
            actual_stock: 15,
            difference: 1,
            purchase_price: 18000,
        },
    ],
};

describe("InventoryPage", () => {
    let fixture: ComponentFixture<InventoryPage>;
    let el: HTMLElement;

    const applyInventory = vi.fn();
    const exportInventory = vi.fn();

    async function render(getInventory: () => unknown) {
        await TestBed.configureTestingModule({
            imports: [InventoryPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "10" })) },
                },
                {
                    provide: InventoryService,
                    useValue: { getInventory, applyInventory, exportInventory },
                },
                { provide: LowStockAlertService, useValue: { count: () => 0 } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(InventoryPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should sum the missing and surplus units", async () => {
        await render(() => of(detail));

        expect(fixture.componentInstance.missing()).toBe(2);
        expect(fixture.componentInstance.surplus()).toBe(1);
        expect(el.textContent).toContain("Riz parfumé 1 kg");
    });

    it("should show the gap summary once and the photo of the products", async () => {
        await render(() => of(detail));

        expect(el.textContent).toContain("Manquants");
        expect(el.textContent).toContain("Valeur de l'écart");
        expect(el.textContent?.split("Valeur de l'écart").length).toBe(2);
        expect(el.querySelectorAll(".panel .table-wrap .thumb-zoom").length).toBe(1);
    });

    it("should put the products with a gap first, the most costly on top", async () => {
        await render(() =>
            of({
                ...detail,
                items: [
                    { ...detail.items[0], id: 7, product_name: "Conforme", difference: 0 },
                    ...detail.items,
                ],
            }),
        );

        const names = fixture.componentInstance.sortedItems().map((i) => i.product_name);
        expect(names).toEqual([
            "Bazin riche Getzner qualité 1 (5 m)",
            "Riz parfumé 1 kg",
            "Conforme",
        ]);
        expect(fixture.componentInstance.conformCount()).toBe(1);
    });

    it("should count the short, surplus and conform products", async () => {
        await render(() =>
            of({
                ...detail,
                items: [{ ...detail.items[0], id: 7, difference: 0 }, ...detail.items],
            }),
        );

        expect(fixture.componentInstance.shortCount()).toBe(1);
        expect(fixture.componentInstance.overCount()).toBe(1);
        expect(fixture.componentInstance.conformCount()).toBe(1);
    });

    it("should count nothing when the inventory has no product", async () => {
        await render(() => of({ ...detail, items: [] }));

        expect(fixture.componentInstance.shortCount()).toBe(0);
        expect(fixture.componentInstance.conformCount()).toBe(0);
    });

    it("should show the author and the tiles in the order short, conform, surplus", async () => {
        await render(() => of({ ...detail, user_avatar: "data:image/png;base64,AAA" }));

        const facts = el.querySelector(".facts")?.textContent ?? "";
        expect(facts).toContain("Auteur");
        expect(facts).toContain("Awa Bazin");
        expect(el.querySelector(".facts app-avatar img")?.getAttribute("src")).toContain("data:");

        const labels = [...el.querySelectorAll(".stat-label")].map((l) => l.textContent?.trim());
        expect(labels).toEqual(["Manquants", "Conformes", "En trop"]);
    });

    it("should export this inventory in the chosen format", async () => {
        exportInventory.mockReturnValue(of(new Blob(["x"])));
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        await render(() => of(detail));

        fixture.componentInstance.exportFile("csv");

        expect(exportInventory).toHaveBeenCalledWith(10, "csv");
        expect(fixture.componentInstance.exporting()).toBe(false);
    });

    it("should offer to apply the gaps only when some product is off", async () => {
        await render(() => of(detail));
        expect(fixture.componentInstance.canApply()).toBe(true);
        expect(el.textContent).toContain("Appliquer au stock");
    });

    it("should not offer to apply an inventory without gap or already applied", async () => {
        await render(() =>
            of({ ...detail, items: detail.items.map((i) => ({ ...i, difference: 0 })) }),
        );
        expect(fixture.componentInstance.canApply()).toBe(false);
    });

    it("should show the date once the stock was corrected", async () => {
        await render(() =>
            of({ ...detail, applied_at: "2026-11-12T16:00:00", applied_by_name: "Awa Bazin" }),
        );

        expect(fixture.componentInstance.canApply()).toBe(false);
        expect(el.textContent).toContain("Appliqué");
    });

    it("should show the message of the server when applying fails", async () => {
        applyInventory.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 409,
                        error: { message: "Cet inventaire a déjà été appliqué." },
                    }),
            ),
        );
        await render(() => of(detail));
        // jsdom ne connaît pas dialog.close()
        const dialog = el.querySelector("dialog") as HTMLDialogElement;
        dialog.close = vi.fn();

        fixture.componentInstance.apply();
        fixture.detectChanges();

        expect(el.textContent).toContain("Cet inventaire a déjà été appliqué.");
        expect(fixture.componentInstance.applying()).toBe(false);
    });

    it("should give a way back to the list", async () => {
        await render(() => of(detail));

        expect(el.querySelector('a[href="/inventories"]')).not.toBeNull();
    });

    it("should say when the inventory does not exist", async () => {
        await render(() => throwError(() => new HttpErrorResponse({ status: 404 })));

        expect(el.textContent).toContain("Cet inventaire est introuvable.");
    });
});

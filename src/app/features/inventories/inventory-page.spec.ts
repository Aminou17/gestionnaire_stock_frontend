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

    async function render(getInventory: () => unknown) {
        await TestBed.configureTestingModule({
            imports: [InventoryPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "10" })) },
                },
                { provide: InventoryService, useValue: { getInventory, applyInventory } },
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

    it("should offer to apply the gaps only when some product is off", async () => {
        await render(() => of(detail));
        expect(fixture.componentInstance.canApply()).toBe(true);
        expect(el.textContent).toContain("Appliquer les écarts au stock");
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
        expect(el.textContent).toContain("Appliqué au stock");
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

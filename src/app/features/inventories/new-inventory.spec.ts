import { HttpErrorResponse } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { NewInventory } from "./new-inventory";
import { CategoryService } from "../../core/stock/category.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ProductService } from "../../core/stock/product.service";

const products = [
    { id: 3, name: "Riz parfumé 1 kg", category_name: "Épicerie", theoretical_stock: 28 },
    {
        id: 13,
        name: "Bazin riche Getzner qualité 1 (5 m)",
        category_name: "Bazin",
        theoretical_stock: 14,
    },
];

describe("NewInventory", () => {
    let fixture: ComponentFixture<NewInventory>;
    let component: NewInventory;
    let el: HTMLElement;
    const createInventory = vi.fn();

    async function render() {
        await TestBed.configureTestingModule({
            imports: [NewInventory],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { createInventory } },
                {
                    provide: ProductService,
                    useValue: { getProducts: () => of({ data: products, total: 2 }) },
                },
                {
                    provide: CategoryService,
                    useValue: {
                        getCategories: () => of([{ id: 1, name: "Bazin", is_active: true }]),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: () => 0 } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(NewInventory);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    beforeEach(() => createInventory.mockReset());

    it("should not show the theoretical stock while counting", async () => {
        await render();

        expect(el.textContent).toContain("Riz parfumé 1 kg");
        expect(el.textContent).not.toContain("28");
    });

    it("should start a product at zero with the plus button", async () => {
        await render();

        component.step(3, 1);
        component.step(13, -1);

        expect(component.counts()).toEqual({ 3: 1, 13: 0 });
        expect(component.countedTotal()).toBe(2);
    });

    it("should uncount a product when its field is emptied", async () => {
        await render();

        component.setCount(3, "26");
        component.setCount(3, "");

        expect(component.counts()).toEqual({});
    });

    it("should keep a typed count between 0 and 1 000 000", async () => {
        await render();

        component.setCount(3, "-4");
        component.setCount(13, "5000000");

        expect(component.counts()).toEqual({ 3: 0, 13: 1000000 });
    });

    it("should fill the gauge with the counted products", async () => {
        await render();

        component.setCount(3, "26");
        fixture.detectChanges();

        expect(component.countedInList()).toBe(1);
        expect(component.progressPercent()).toBe(50);
        expect(el.querySelector(".progress-text")?.textContent).toContain("1 / 2");
    });

    it("should show the product photo or its initials", async () => {
        await render();

        expect(el.querySelector(".avatar")?.textContent).toContain("RP");
    });

    it("should filter the products by name", async () => {
        await render();

        component.search.set("bazin");

        expect(component.visible().map((p) => p.id)).toEqual([13]);
    });

    it("should send only the counted products then open the inventory", async () => {
        createInventory.mockReturnValue(of({ id: 11 }));
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        component.setCount(3, "26");
        component.save();

        expect(createInventory).toHaveBeenCalledWith([{ productId: 3, actualStock: 26 }]);
        expect(navigate).toHaveBeenCalledWith(["/inventories", 11], { replaceUrl: true });
    });

    it("should not send anything when no product is counted", async () => {
        await render();

        component.save();

        expect(createInventory).not.toHaveBeenCalled();
    });

    it("should show the message of the server when saving fails", async () => {
        createInventory.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: { message: "Un produit désactivé ne peut pas être compté." },
                    }),
            ),
        );
        await render();

        component.setCount(3, "26");
        component.save();
        fixture.detectChanges();

        expect(el.textContent).toContain("Un produit désactivé ne peut pas être compté.");
        expect(component.saving()).toBe(false);
    });
});

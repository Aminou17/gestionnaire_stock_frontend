import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";
import { Router } from "@angular/router";

import { ProductPage } from "./product-page";
import { AuthService } from "../../../core/auth/auth.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { ProductService } from "../../../core/stock/product.service";
import { CategoryService } from "../../../core/stock/category.service";
import { StockMovementService } from "../../../core/stock/stock-movement.service";
import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { SupplierService } from "../../../core/stock/supplier.service";

describe("ProductPage", () => {
    let fixture: ComponentFixture<ProductPage>;
    let el: HTMLElement;
    let getProduct: ReturnType<typeof vi.fn>;

    let deleteProduct: ReturnType<typeof vi.fn>;

    async function render(isAdmin: boolean, fails: number | false = false, stock = 5) {
        deleteProduct = vi.fn(() => of({ message: "ok" }));
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        getProduct = vi.fn(() =>
            fails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: fails,
                              error: { message: "Erreur serveur." },
                          }),
                  )
                : of({
                      id: 3,
                      name: "Savon Marseille",
                      category_name: "Hygiène",
                      purchase_price: 600,
                      sale_price: 1000,
                      pricing_mode: "NEGOTIABLE",
                      max_discount: 100,
                      theoretical_stock: stock,
                      is_active: true,
                      min_stock: null,
                      effective_min_stock: 10,
                      stock_status: "LOW",
                  }),
        );

        await TestBed.configureTestingModule({
            imports: [ProductPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "3" })) },
                },
                { provide: ProductService, useValue: { getProduct, deleteProduct } },
                { provide: CategoryService, useValue: { getCategories: () => of([]) } },
                { provide: SupplierService, useValue: { getSuppliers: () => of([]) } },
                { provide: StockSettingsService, useValue: { getSettings: () => of(null) } },
                {
                    provide: StockMovementService,
                    useValue: {
                        getMovements: () => of({ data: [], total: 0, counters: {} }),
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({ id: 1, name: "Admin Test", email: "a@test.com" }),
                        roleLabel: signal("Propriétaire"),
                    },
                },
                {
                    provide: LowStockAlertService,
                    useValue: { count: signal(0), alerts: { reload: () => {} } },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ProductPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should load the product of the URL and show its details", async () => {
        await render(true);

        expect(getProduct).toHaveBeenCalledWith(3);
        expect(text()).toContain("Savon Marseille");
        expect(text()).toContain("Hygiène");
        expect(text()).toContain("Prix minimum");
        expect(text()).toContain("900 F");
        expect(text()).toContain("10 (par défaut)");
        expect(text()).toContain("600 F");
    });

    it("should let the manager sell, without the purchase price nor the menu", async () => {
        await render(false);

        expect(text()).not.toContain("Prix d'achat");
        expect(el.querySelector(".sell")).not.toBeNull();
        expect(el.querySelector(".more-btn")).toBeNull();
    });

    it("should go to the sale with this product", async () => {
        await render(false);
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(".sell")!.click();

        expect(navigate).toHaveBeenCalledWith(["/sales/new"], { queryParams: { productId: 3 } });
    });

    it("should not allow selling a product out of stock", async () => {
        await render(false, false, 0);
        expect(el.querySelector<HTMLButtonElement>(".sell")!.disabled).toBe(true);
    });

    it("should give the admin a menu to edit or delete, then go back to the list", async () => {
        await render(true);
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        expect(text()).toContain("Modifier");

        el.querySelector<HTMLButtonElement>(".menu .danger")!.click();
        el.querySelector<HTMLButtonElement>(".confirm .btn-danger")!.click();

        expect(deleteProduct).toHaveBeenCalledWith(3);
        expect(navigate).toHaveBeenCalledWith(["/products"]);
    });

    it("should explain when the product cannot be found", async () => {
        await render(true, 404);
        expect(text()).toContain("introuvable ou a été supprimé");
    });

    it("should show the API message and a retry button for other errors", async () => {
        await render(true, 500);

        expect(text()).toContain("Erreur serveur.");
        expect(text()).toContain("Réessayer");
        expect(text()).not.toContain("introuvable");
    });
});

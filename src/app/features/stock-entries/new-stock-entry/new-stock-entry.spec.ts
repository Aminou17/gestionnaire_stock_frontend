import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { NewStockEntry } from "./new-stock-entry";
import { AuthService } from "../../../core/auth/auth.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { CategoryService } from "../../../core/stock/category.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { StockEntryService } from "../../../core/stock/stock-entry.service";
import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { SupplierService } from "../../../core/stock/supplier.service";

const product = (overrides: Partial<Product>): Product =>
    ({
        id: 3,
        name: "Riz",
        category_name: "Céréales",
        sale_price: 1500,
        pricing_mode: "FIXED",
        max_discount: 0,
        theoretical_stock: 45,
        is_active: true,
        barcode: "6111234567890",
        min_stock: null,
        effective_min_stock: 10,
        stock_status: "OK",
        ...overrides,
    }) as Product;

const riz = product({});
const pagne = product({ id: 4, name: "Pagne", barcode: null, theoretical_stock: 2 });

describe("NewStockEntry", () => {
    let fixture: ComponentFixture<NewStockEntry>;
    let el: HTMLElement;
    let createEntry: ReturnType<typeof vi.fn>;
    let getProducts: ReturnType<typeof vi.fn>;
    let reloadAlerts: ReturnType<typeof vi.fn>;

    async function render({
        query = {} as Record<string, string>,
        failOn = null as number | null,
        found = [riz] as Product[],
    } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        createEntry = vi.fn((input: { productId: number }) =>
            input.productId === failOn
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 404,
                              error: { message: "Ce produit est désactivé." },
                          }),
                  )
                : of({ id: 12 }),
        );
        getProducts = vi.fn(() => of({ data: found, total: found.length, counters: {} }));
        reloadAlerts = vi.fn();

        await TestBed.configureTestingModule({
            imports: [NewStockEntry],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
                },
                { provide: StockEntryService, useValue: { createEntry } },
                {
                    provide: ProductService,
                    useValue: {
                        getProducts,
                        getProduct: (id: number) =>
                            of({
                                ...(id === 4 ? pagne : riz),
                                supplier_id: 1,
                                category_id: 2,
                                created_at: null,
                            }),
                    },
                },
                {
                    provide: SupplierService,
                    useValue: {
                        getSuppliers: () =>
                            of([
                                { id: 1, name: "Tissus du Faso", is_active: true },
                                { id: 2, name: "Ancien", is_active: false },
                            ]),
                        createSupplier: vi.fn(() =>
                            of({ id: 7, name: "Wax Lomé", is_active: true }),
                        ),
                    },
                },
                { provide: CategoryService, useValue: { getCategories: () => of([]) } },
                { provide: SalesSettingsService, useValue: { getSettings: () => of({}) } },
                {
                    provide: StockSettingsService,
                    useValue: { getSettings: () => of({ default_min_stock: 5 }) },
                },
                {
                    provide: LowStockAlertService,
                    useValue: { count: signal(0), alerts: { reload: reloadAlerts } },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Admin", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(NewStockEntry);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const component = () => fixture.componentInstance;
    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should start with the product and quantity of the address, and its usual supplier", async () => {
        await render({ query: { productId: "3", quantity: "12" } });

        expect(component().lines()).toEqual([
            { product: expect.objectContaining({ id: 3 }), quantity: 12 },
        ]);
        expect(component().supplierId()).toBe(1);
        // Stock actuel et stock après l'entrée
        expect(text()).toContain("57 en stock");
    });

    it("should add one more unit when the same product is added again", async () => {
        await render();
        component().addProduct(riz);
        component().addProduct(riz);
        component().addProduct(pagne);

        expect(
            component()
                .lines()
                .map((line) => line.quantity),
        ).toEqual([2, 1]);
        expect(component().units()).toBe(3);
    });

    it("should add the scanned product, or offer to create it when the code is unknown", async () => {
        await render();
        component().onScanned("6111234567890");
        expect(component().lines()[0].product.id).toBe(3);

        TestBed.resetTestingModule();
        await render({ found: [] });
        component().onScanned("999");
        await fixture.whenStable();

        expect(component().lines()).toEqual([]);
        expect(text()).toContain("Aucun produit ne porte le code 999");
    });

    it("should only offer active suppliers", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".supplier-row select")!;

        expect(select.textContent).toContain("Tissus du Faso");
        expect(select.textContent).not.toContain("Ancien");
    });

    it("should refuse to save without a product or a supplier", async () => {
        await render();
        component().submit();
        expect(component().error()).toBe("Ajoutez au moins un produit reçu.");

        component().lines.set([{ product: riz, quantity: 2 }]);
        component().supplierId.set(null);
        component().submit();

        expect(createEntry).not.toHaveBeenCalled();
    });

    it("should save one entry per product, then go back", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
        component().lines.set([
            { product: riz, quantity: 5 },
            { product: pagne, quantity: 3 },
        ]);
        component().supplierId.set(1);

        component().submit();
        await fixture.whenStable();

        expect(createEntry.mock.calls.map((call) => call[0])).toEqual([
            { productId: 3, supplierId: 1, quantity: 5 },
            { productId: 4, supplierId: 1, quantity: 3 },
        ]);
        expect(reloadAlerts).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalled();
    });

    it("should keep only the products not saved when one entry is refused", async () => {
        await render({ failOn: 4 });
        component().lines.set([
            { product: riz, quantity: 5 },
            { product: pagne, quantity: 3 },
        ]);
        component().supplierId.set(1);

        component().submit();
        await fixture.whenStable();

        expect(
            component()
                .lines()
                .map((line) => line.product.id),
        ).toEqual([4]);
        expect(component().error()).toContain("1 produit enregistré");
        expect(component().error()).toContain("Ce produit est désactivé.");
    });
});

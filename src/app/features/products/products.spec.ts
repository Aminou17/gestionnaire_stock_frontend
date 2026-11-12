import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { Products } from "./products";
import { AuthService } from "../../core/auth/auth.service";
import { CategoryService } from "../../core/stock/category.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Product, ProductPage } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { StockSettingsService } from "../../core/stock/stock-settings.service";
import { SupplierService } from "../../core/stock/supplier.service";

const product = (data: Partial<Product>): Product => ({
    id: 1,
    name: "Riz parfumé 5 kg",
    category_name: "Céréales",
    sale_price: 1500,
    pricing_mode: "FIXED",
    max_discount: 0,
    theoretical_stock: 45,
    is_active: true,
    min_stock: null,
    effective_min_stock: 10,
    stock_status: "OK",
    ...data,
});

describe("Products", () => {
    let fixture: ComponentFixture<Products>;
    let el: HTMLElement;
    let getProducts: ReturnType<typeof vi.fn>;
    let observerCallback: IntersectionObserverCallback;

    async function render(
        isAdmin: boolean,
        data: Product[],
        total = data.length,
        query: Record<string, string> = {},
    ) {
        const page: ProductPage = {
            data,
            total,
            counters: { total_products: 4, in_stock: 2, low_stock: 1, out_of_stock: 1 },
        };
        getProducts = vi.fn(() => of(page));
        // jsdom ne gère ni <dialog> ni IntersectionObserver
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                constructor(callback: IntersectionObserverCallback) {
                    observerCallback = callback;
                }
                observe() {}
                disconnect() {}
            },
        );

        await TestBed.configureTestingModule({
            imports: [Products],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParamMap: convertToParamMap(query) },
                        queryParamMap: of(convertToParamMap(query)),
                    },
                },
                { provide: ProductService, useValue: { getProducts } },
                { provide: CategoryService, useValue: { getCategories: () => of([]) } },
                {
                    provide: SupplierService,
                    useValue: {
                        getSuppliers: () => of([]),
                        getSupplier: () => of({ id: 4, name: "Faso Distribution" }),
                    },
                },
                { provide: StockSettingsService, useValue: { getSettings: () => of(null) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({ id: 1, name: "Admin Test", email: "a@test.com" }),
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                    },
                },
                {
                    provide: LowStockAlertService,
                    useValue: { count: signal(0), alerts: { reload: () => {} } },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Products);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    afterEach(() => vi.unstubAllGlobals());

    const text = (node: Element | null = el) => node!.textContent!.replace(/\s+/g, " ");

    it("should take the filter counters from the summary, not from the loaded page", async () => {
        await render(true, [product({})]);

        expect(text(el.querySelector(".chips"))).toContain("Tous 4");
        expect(text(el.querySelector(".chips"))).toContain("Rupture 1");
    });

    it("should show a compact card: name, category, price, stock and threshold", async () => {
        await render(true, [product({})]);

        const card = text(el.querySelector(".product-card"));
        expect(card).toContain("Riz parfumé 5 kg");
        expect(card).toContain("Céréales");
        expect(card).toContain("1 500 F");
        expect(card).toContain("Stock 45 / seuil 10");
        expect(card).toContain("En stock");
    });

    it("should show the minimum price only for negotiable products, never Fixe", async () => {
        await render(true, [
            product({ id: 1, pricing_mode: "NEGOTIABLE", sale_price: 1500, max_discount: 200 }),
            product({ id: 2 }),
        ]);

        const cards = el.querySelectorAll(".product-card");
        expect(text(cards[0])).toContain("Min. 1 300 F");
        expect(text(cards[0])).not.toContain("Négociable");
        expect(cards[0].querySelector(".badge-violet")).not.toBeNull();
        expect(cards[1].querySelector(".badge-violet")).toBeNull();
        expect(text()).not.toContain("Fixe");
    });

    it("should color the stock in orange when low and in red when out of stock", async () => {
        await render(true, [
            product({ id: 1, stock_status: "LOW", theoretical_stock: 5 }),
            product({ id: 2, stock_status: "OUT_OF_STOCK", theoretical_stock: 0 }),
        ]);

        const cards = el.querySelectorAll(".product-card");
        expect(cards[0].querySelector(".stock-LOW")?.textContent?.trim()).toBe("5");
        expect(cards[1].querySelector(".stock-OUT_OF_STOCK")?.textContent?.trim()).toBe("0");
    });

    it("should give the admin the + button and the actions menu", async () => {
        await render(true, [product({ purchase_price: 1100 })]);

        expect(el.querySelector(".fab")).not.toBeNull();
        expect(el.querySelector(".product-card .more-btn")).not.toBeNull();
        expect(text()).toContain("Prix d'achat");
    });

    it("should show the list read-only to the manager", async () => {
        await render(false, [product({})]);

        expect(el.querySelector(".fab")).toBeNull();
        expect(el.querySelector(".new-product")).toBeNull();
        expect(el.querySelector(".more-btn")).toBeNull();
        expect(text()).not.toContain("Prix d'achat");
        expect(el.querySelectorAll(".filters select").length).toBe(1);
    });

    it("should never say désactivé", async () => {
        await render(true, [product({ is_active: false })]);

        expect(text()).toContain("Supprimé");
        expect(text().toLowerCase()).not.toContain("désactiv");
    });

    it("should filter on the supplier of the address and let the admin remove it", async () => {
        await render(true, [product({})], 1, { supplierId: "4" });

        expect(getProducts.mock.lastCall![0]).toEqual(expect.objectContaining({ supplierId: 4 }));
        expect(text(el.querySelector(".supplier-filter"))).toContain("Faso Distribution");

        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
        el.querySelector<HTMLButtonElement>(".clear-filter")!.click();
        await fixture.whenStable();

        expect(getProducts.mock.lastCall![0]).toEqual(
            expect.objectContaining({ supplierId: null }),
        );
        expect(navigate).toHaveBeenCalledWith(
            [],
            expect.objectContaining({ queryParams: { supplierId: null } }),
        );
    });

    it("should open /products/:id when a card is clicked", async () => {
        await render(false, [product({ id: 7 })]);
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        el.querySelector<HTMLElement>(".product-card")!.click();

        expect(navigate).toHaveBeenCalledWith(["/products", 7]);
    });

    it("should not open the product when the actions menu is clicked", async () => {
        await render(true, [product({})]);
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(".product-card .more-btn")!.click();
        await fixture.whenStable();

        expect(navigate).not.toHaveBeenCalled();
        expect(text(el.querySelector(".product-card .menu"))).toContain("Supprimer");
    });

    it("should load 20 products, then the next page when the bottom is reached", async () => {
        await render(true, [product({ id: 1 })], 30);
        expect(getProducts).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1, limit: 20 }),
        );

        observerCallback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        );
        await fixture.whenStable();

        expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
        expect(el.querySelectorAll(".product-card").length).toBe(2);
    });

    it("should filter by stock state and start again from the first page", async () => {
        await render(true, [product({})]);

        el.querySelectorAll<HTMLButtonElement>(".stat")[2].click();
        await fixture.whenStable();

        expect(getProducts).toHaveBeenLastCalledWith(
            expect.objectContaining({ stockStatus: "LOW", page: 1 }),
        );
    });

    it("should filter by the category given in the URL and ignore an invalid one", async () => {
        await render(true, [], 0, { categoryId: "2" });
        expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 2 }));

        TestBed.resetTestingModule();
        await render(true, [], 0, { categoryId: "1.5" });
        expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: null }));
    });
});

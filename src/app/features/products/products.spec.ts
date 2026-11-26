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

    async function render(
        isAdmin: boolean,
        data: Product[],
        total = data.length,
        query: Record<string, string> = {},
    ) {
        const page: ProductPage = {
            data,
            total,
            counters: {
                total_products: 4,
                in_stock: 2,
                low_stock: 1,
                out_of_stock: 1,
                // Le backend n'envoie la valeur du stock qu'à l'admin
                ...(isAdmin ? { stock_value: 120000 } : {}),
            },
        };
        getProducts = vi.fn(() => of(page));
        // Jsdom ne gère pas <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        localStorage.removeItem("page-size-products");

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
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Admin Test", email: "a@test.com" }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
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
        expect(card).toContain("45 en stock");
        expect(card).not.toContain("seuil");
        expect(card).not.toContain("En stock");
    });

    it("should not show the minimum price nor Fixe in the list", async () => {
        await render(true, [
            product({ id: 1, pricing_mode: "NEGOTIABLE", sale_price: 1500, max_discount: 200 }),
            product({ id: 2 }),
        ]);

        expect(text(el.querySelector(".list-card"))).not.toContain("Min.");
        expect(text()).not.toContain("Fixe");
    });

    it("should show the margin to the admin only", async () => {
        await render(true, [product({ sale_price: 1500, purchase_price: 800 })]);
        expect(text(el.querySelector("table"))).toContain("Marge");
        expect(text(el.querySelector("tbody"))).toContain("47 %");
    });

    it("should ask the backend for the chosen sort", async () => {
        await render(true, [product({})]);

        const select = el.querySelector<HTMLSelectElement>('select[aria-label="Trier par"]')!;
        select.value = "price_desc";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        expect(getProducts.mock.lastCall![0]).toEqual(
            expect.objectContaining({ sort: "price_desc", page: 1 }),
        );
    });

    it("should show the stock as a green, orange or red pill", async () => {
        await render(true, [
            product({ id: 1, stock_status: "OK", theoretical_stock: 20 }),
            product({ id: 2, stock_status: "LOW", theoretical_stock: 5 }),
            product({ id: 3, stock_status: "OUT_OF_STOCK", theoretical_stock: 0 }),
        ]);

        const cards = el.querySelectorAll(".product-card");
        expect(cards[0].querySelector(".badge-success")?.textContent?.trim()).toBe("20 en stock");
        expect(cards[1].querySelector(".badge-warning")?.textContent?.trim()).toBe(
            "5 en stock · faible",
        );
        expect(cards[2].querySelector(".badge-danger")?.textContent?.trim()).toBe("Rupture");
    });

    it("should switch to the grid view and remember the choice", async () => {
        await render(true, [product({ id: 1 }), product({ id: 2, name: "Pagne" })]);

        expect(el.querySelector("table")).not.toBeNull();
        expect(el.querySelector(".grid")).toBeNull();

        (el.querySelector(".view-single") as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(el.querySelector("table")).toBeNull();
        expect(el.querySelectorAll(".gcard").length).toBe(2);
        expect(localStorage.getItem("products-view")).toBe("grid");
        localStorage.removeItem("products-view");
    });

    it("should give the admin a single download icon, without import", async () => {
        await render(true, [product({})]);

        expect(el.querySelector("app-export-menu.icon-only")).not.toBeNull();
        expect(el.textContent).not.toContain("Importer");
    });

    it("should give the admin the + button and the actions menu", async () => {
        await render(true, [product({ purchase_price: 1100 })]);

        expect(el.querySelector(".new-product")).not.toBeNull();
        expect(el.querySelector(".new-product")?.getAttribute("aria-label")).toBe(
            "Nouveau produit",
        );
        expect(el.querySelector(".product-card .more-btn")).not.toBeNull();
        expect(text()).toContain("Prix d'achat");
    });

    it("should label the filter button and count the active filters", async () => {
        await render(true, [product({})]);

        const button = el.querySelector(".filter-btn") as HTMLButtonElement;
        expect(button.textContent).toContain("Filtre");
        expect(el.querySelector(".filter-count")).toBeNull();

        const sort = [...el.querySelectorAll(".filters select")].pop() as HTMLSelectElement;
        sort.value = "name";
        sort.dispatchEvent(new Event("change"));
        fixture.detectChanges();

        expect(el.querySelector(".filter-count")?.textContent?.trim()).toBe("1");
    });

    it("should load photos lazily", async () => {
        await render(true, [product({ image: "data:image/jpeg;base64,AAAA" })]);

        const img = el.querySelector(".product-card img") as HTMLImageElement;
        expect(img.getAttribute("loading")).toBe("lazy");
        expect(img.getAttribute("decoding")).toBe("async");
    });

    it("should show the list read-only to the manager", async () => {
        await render(false, [product({})]);

        expect(el.querySelector(".new-product")).toBeNull();
        expect(el.querySelector(".fab")).toBeNull();
        expect(text()).not.toContain("Prix d'achat");
        expect(text()).not.toContain("Marge");
        expect(el.querySelectorAll(".filters select").length).toBe(3);
    });

    it("should give the manager only the Vendre action in the row menu", async () => {
        await render(false, [product({ theoretical_stock: 5 })]);

        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();

        // Le tableau et les cartes ont chacun leur menu : on ne garde que les libellés
        const items = [...el.querySelectorAll('[role="menuitem"]')].map((i) => text(i).trim());
        expect([...new Set(items)]).toEqual(["Vendre"]);
    });

    it("should show the stock value to the admin only", async () => {
        await render(true, [product({})]);
        expect(text(el.querySelector(".value-card"))).toContain("Valeur totale");
    });

    it("should not show the stock value to the manager", async () => {
        await render(false, [product({})]);
        expect(el.querySelector(".value-card")).toBeNull();
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
        expect(text(el.querySelector(".product-card .panel"))).toContain("Supprimer");
    });

    it("should load 25 products per page and go to the next page with Suivant", async () => {
        await render(true, [product({ id: 1 })], 60);
        expect(getProducts).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1, limit: 25 }),
        );
        expect(text(el.querySelector("app-pagination"))).toContain("1 à 25 sur 60");

        el.querySelector<HTMLButtonElement>("app-pagination .next")!.click();
        await fixture.whenStable();

        expect(getProducts).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2, limit: 25 }),
        );
        expect(text(el.querySelector("app-pagination"))).toContain("26 à 50 sur 60");
    });

    it("should not show the pagination when everything fits one small page", async () => {
        await render(true, [product({ id: 1 })], 4);
        expect(el.querySelector("app-pagination nav")).toBeNull();
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

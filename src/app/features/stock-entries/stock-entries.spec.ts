import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { StockEntries } from "./stock-entries";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Product } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { StockEntry, StockEntryFilters } from "../../core/stock/stock-entry.model";
import { StockEntryService } from "../../core/stock/stock-entry.service";
import { SupplierService } from "../../core/stock/supplier.service";

const riz = {
    id: 3,
    name: "Riz",
    category_name: "Céréales",
    sale_price: 1500,
    pricing_mode: "FIXED",
    max_discount: 0,
    theoretical_stock: 45,
    is_active: true,
    min_stock: null,
    effective_min_stock: 10,
    stock_status: "OK",
} as Product;

const entry: StockEntry = {
    id: 11,
    product_id: 3,
    product_name: "Riz",
    supplier_id: 1,
    supplier_name: "Tissus du Faso",
    user_id: 1,
    user_name: "Admin Test",
    quantity: 5,
    date_creation: "2026-10-28T12:33:48",
};

describe("StockEntries", () => {
    let fixture: ComponentFixture<StockEntries>;
    let el: HTMLElement;
    let getEntries: ReturnType<typeof vi.fn>;
    let reloadAlerts: ReturnType<typeof vi.fn>;

    async function render({
        query = {} as Record<string, string>,
        image = null as string | null,
    } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                observe() {}
                disconnect() {}
            },
        );
        getEntries = vi.fn(() =>
            of({
                data: [{ ...entry, image }],
                total: 1,
                counters: { entries: 1, units: 5, products: 1, suppliers: 1 },
            }),
        );
        reloadAlerts = vi.fn();

        await TestBed.configureTestingModule({
            imports: [StockEntries],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
                },
                { provide: StockEntryService, useValue: { getEntries } },
                {
                    provide: ProductService,
                    useValue: {
                        getProducts: () => of({ data: [riz], total: 1, counters: {} }),
                        getProduct: () =>
                            of({ ...riz, supplier_id: 1, category_id: 2, created_at: null }),
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
                {
                    provide: LowStockAlertService,
                    useValue: { count: signal(0), alerts: { reload: reloadAlerts } },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Admin Test",
                            email: "a@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StockEntries);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should show the totals and the entries with their names", async () => {
        await render();

        expect(text()).toContain("Unités reçues");
        expect(text()).toContain("Tissus du Faso");
        expect(el.querySelector("tbody .qty-pill")?.textContent).toContain("+5");
        expect(el.querySelector("tbody a")?.getAttribute("href")).toBe("/products/3");
    });

    it("should show initials without a photo and zoom the photo without opening the product", async () => {
        await render();

        expect(el.querySelector("tbody .thumb")?.textContent).toContain("RI");
        expect(el.querySelector(".thumb-zoom")).toBeNull();

        TestBed.resetTestingModule();
        await render({ image: "data:image/png;base64,MINI" });
        const link = el.querySelector<HTMLAnchorElement>("tbody a")!;
        const navigated = vi.fn((event: Event) => event.preventDefault());
        link.addEventListener("click", navigated);

        el.querySelector<HTMLButtonElement>("tbody .thumb-zoom")!.click();
        await fixture.whenStable();

        expect(el.querySelector("app-photo-zoom img")!.getAttribute("src")).toContain("MINI");
        expect(navigated).not.toHaveBeenCalled();
    });

    it("should only offer active suppliers in the filter and filter from page 1", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".supplier-filter select")!;
        expect(select.textContent).not.toContain("Ancien");

        select.value = "1";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        const filters = getEntries.mock.lastCall![0] as StockEntryFilters;
        expect(filters).toEqual(expect.objectContaining({ supplierId: 1, page: 1 }));
    });

    it("should start filtered on the supplier given in the address", async () => {
        await render({ query: { supplierId: "1" } });

        const filters = getEntries.mock.lastCall![0] as StockEntryFilters;
        expect(filters).toEqual(expect.objectContaining({ supplierId: 1 }));
        expect(el.querySelector<HTMLSelectElement>(".supplier-filter select")!.value).toBe("1");
    });

    it("should send old links with a product to the new entry page", async () => {
        const navigate = vi.spyOn(Router.prototype, "navigate").mockResolvedValue(true);
        await render({ query: { productId: "3", quantity: "12" } });

        expect(navigate).toHaveBeenCalledWith(["/stock-entries/new"], {
            queryParams: { productId: "3", quantity: "12", supplierId: null },
            replaceUrl: true,
        });
        navigate.mockRestore();
    });

    it("should show every entry when the supplier of the address is deleted", async () => {
        await render({ query: { supplierId: "2" } });

        const filters = getEntries.mock.lastCall![0] as StockEntryFilters;
        expect(filters.supplierId).toBeNull();
    });
});

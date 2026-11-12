import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { ProductForm } from "./product-form";
import { CategoryService } from "../../../core/stock/category.service";
import { ProductService } from "../../../core/stock/product.service";
import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { SupplierService } from "../../../core/stock/supplier.service";

describe("ProductForm", () => {
    let fixture: ComponentFixture<ProductForm>;
    let component: ProductForm;
    let el: HTMLElement;
    let createProduct: ReturnType<typeof vi.fn>;
    let updateProduct: ReturnType<typeof vi.fn>;
    let createSupplier: ReturnType<typeof vi.fn>;
    let createCategory: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        createProduct = vi.fn(() => of({}));
        updateProduct = vi.fn(() => of({}));
        createSupplier = vi.fn(() => of({ id: 9, name: "Tissus du Faso", is_active: true }));
        createCategory = vi.fn(() =>
            of({
                id: 12,
                name: "Wax",
                description: "Pagnes wax",
                is_active: true,
                product_count: 0,
            }),
        );
        // jsdom ne gère pas encore <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        await TestBed.configureTestingModule({
            imports: [ProductForm],
            providers: [
                {
                    provide: ProductService,
                    useValue: {
                        createProduct,
                        updateProduct,
                        getProduct: () =>
                            of({
                                id: 7,
                                name: "Savon",
                                category_id: 1,
                                supplier_id: 2,
                                purchase_price: 600,
                                sale_price: 1000,
                                pricing_mode: "FIXED",
                                max_discount: 0,
                                min_stock: 8,
                            }),
                    },
                },
                {
                    provide: CategoryService,
                    useValue: {
                        getCategories: () => of([{ id: 1, name: "Tissus", is_active: true }]),
                        createCategory,
                    },
                },
                {
                    provide: SupplierService,
                    useValue: {
                        getSuppliers: () => of([{ id: 2, name: "Distri Bobo", is_active: true }]),
                        createSupplier,
                    },
                },
                {
                    provide: StockSettingsService,
                    useValue: { getSettings: () => of({ id: 1, min_stock: 5 }) },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ProductForm);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        await fixture.whenStable();
    });

    const fill = (
        pricingMode: "FIXED" | "NEGOTIABLE",
        maxDiscount: number | null,
        minStock: number | null = null,
    ) =>
        component.form.setValue({
            name: " Pagne wax ",
            categoryId: 1,
            supplierId: 2,
            purchasePrice: 9000,
            salePrice: 15000,
            pricingMode,
            maxDiscount,
            minStock,
        });

    it("should send a discount of 0 for a fixed price", () => {
        component.openNew();
        fill("FIXED", null);
        component.submit();

        expect(createProduct).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Pagne wax", pricingMode: "FIXED", maxDiscount: 0 }),
        );
    });

    it("should show the margin and the price range of a negotiable product", async () => {
        component.openNew();
        fill("NEGOTIABLE", 1500);
        await fixture.whenStable();

        const text = el.textContent!.replace(/\s+/g, " ");
        expect(text).toContain("Marge : 6 000 F (40 %)");
        expect(text).toContain("entre 13 500 F et 15 000 F");
    });

    it("should refuse a negotiable product without a discount", () => {
        component.openNew();
        fill("NEGOTIABLE", null);
        component.submit();

        expect(createProduct).not.toHaveBeenCalled();
    });

    it("should refuse a discount above the sale price", () => {
        component.openNew();
        fill("NEGOTIABLE", 20000);
        component.submit();

        expect(component.form.hasError("discountTooHigh")).toBe(true);
        expect(createProduct).not.toHaveBeenCalled();
    });

    it("should send no threshold when left empty, so the default one applies", async () => {
        component.openNew();
        await fixture.whenStable();
        expect(el.textContent).toContain("seuil par défaut (5)");

        fill("FIXED", null, null);
        component.submit();

        expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ minStock: null }));
    });

    async function pick(control: "categoryId" | "supplierId", value: number) {
        component.form.controls[control].setValue(value);
        await fixture.whenStable();
    }

    it("should open the supplier form from the list and select the new supplier", async () => {
        component.openNew();
        await fixture.whenStable();

        await pick("supplierId", -1);
        expect(component.addingSupplier()).toBe(true);
        // "+ Créer" n'est jamais gardé comme choix
        expect(component.form.controls.supplierId.value).toBe(0);

        component.supplierForm.setValue({ name: " Tissus du Faso ", telephone: "" });
        component.addSupplier();
        await fixture.whenStable();

        expect(createSupplier).toHaveBeenCalledWith({ name: "Tissus du Faso", telephone: null });
        expect(component.form.controls.supplierId.value).toBe(9);
        expect(component.supplierList().map((s) => s.name)).toContain("Tissus du Faso");
        expect(component.addingSupplier()).toBe(false);
        expect(createProduct).not.toHaveBeenCalled();
    });

    it("should not create a supplier without a name", async () => {
        component.openNew();
        await pick("supplierId", -1);
        component.addSupplier();

        expect(createSupplier).not.toHaveBeenCalled();
    });

    it("should keep the previous category when the new category form is cancelled", async () => {
        component.openNew();
        await pick("categoryId", 1);
        await pick("categoryId", -1);

        expect(component.addingCategory()).toBe(true);
        expect(component.form.controls.categoryId.value).toBe(1);

        component.cancelCategory();
        expect(component.addingCategory()).toBe(false);
        expect(component.form.controls.categoryId.value).toBe(1);
    });

    it("should create a category with its description and select it", async () => {
        component.openNew();
        await pick("categoryId", -1);

        component.categoryForm.setValue({ name: " Wax ", description: "  Pagnes wax  " });
        component.addCategory();
        await fixture.whenStable();

        expect(createCategory).toHaveBeenCalledWith("Wax", "Pagnes wax");
        expect(component.form.controls.categoryId.value).toBe(12);
        expect(component.activeCategories().map((c) => c.name)).toContain("Wax");
    });

    it("should load and save the product threshold when editing", () => {
        component.openEdit(7);
        expect(component.form.controls.minStock.value).toBe(8);

        component.form.controls.minStock.setValue(12);
        component.submit();

        expect(updateProduct).toHaveBeenCalledWith(7, expect.objectContaining({ minStock: 12 }));
    });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse, provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { CategoryPage } from "./category-page";
import { AuthService } from "../../../core/auth/auth.service";
import { CategoryDetail } from "../../../core/stock/category.model";
import { CategoryService } from "../../../core/stock/category.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { ProductService } from "../../../core/stock/product.service";

const wax: CategoryDetail = {
    id: 4,
    name: "Wax",
    description: "Pagnes wax imprimés",
    is_active: true,
    created_at: "2026-11-11T09:30:00",
    product_count: 2,
    total_stock: 13,
    low_stock_count: 1,
    out_of_stock_count: 0,
};

// ce que le backend ajoute pour l'admin
const adminExtras = {
    stock_value: 245500,
    last_change: {
        action: "CATEGORY_UPDATED",
        at: "2026-11-11T15:21:00Z",
        user_name: "Admin Test",
    },
};

const products = [
    { id: 10, name: "Wax bleu", sale_price: 7500, theoretical_stock: 12, stock_status: "OK" },
    { id: 11, name: "Wax rouge", sale_price: 8000, theoretical_stock: 1, stock_status: "LOW" },
];

describe("CategoryPage", () => {
    let fixture: ComponentFixture<CategoryPage>;
    let el: HTMLElement;
    let getCategory: ReturnType<typeof vi.fn>;
    let restoreCategory: ReturnType<typeof vi.fn>;
    let getProducts: ReturnType<typeof vi.fn>;

    async function render({ id = "4", category = wax, status = 0, admin = false } = {}) {
        getCategory = vi.fn(() =>
            status ? throwError(() => new HttpErrorResponse({ status, error: {} })) : of(category),
        );

        restoreCategory = vi.fn(() => of({ ...category, is_active: true }));
        getProducts = vi.fn(() => of({ data: products, total: 2, counters: {} }));

        await TestBed.configureTestingModule({
            imports: [CategoryPage],
            providers: [
                provideRouter([]),
                // le formulaire produit (admin) injecte les services HTTP du stock
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
                { provide: CategoryService, useValue: { getCategory, restoreCategory } },
                { provide: ProductService, useValue: { getProducts } },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(admin),
                        user: signal({
                            id: 6,
                            name: "Awa K.",
                            email: "a@test.com",
                            role: "manager",
                        }),
                        roleLabel: signal("Gérant"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CategoryPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should show the description, the creation date and the product count", async () => {
        await render();

        expect(text()).toContain("Pagnes wax imprimés");
        expect(text()).toContain("2026");
        expect(el.querySelector("dd.strong")?.textContent?.trim()).toBe("2");
        // le nombre de produits et le bouton mènent tous deux aux produits de la catégorie
        expect(el.querySelector("a.count-link")?.getAttribute("href")).toBe(
            "/products?categoryId=4",
        );
        expect(el.querySelector(".sheet .actions a.btn")?.getAttribute("href")).toBe(
            "/products?categoryId=4",
        );
    });

    it("should hide the unknown date and say when there is no description", async () => {
        await render({ category: { ...wax, description: null, created_at: null } });

        expect(text()).toContain("Aucune description");
        expect(text()).not.toContain("Créée le");
    });

    it("should list the first products of the category with their stock", async () => {
        await render();

        expect(getProducts).toHaveBeenCalledWith(
            expect.objectContaining({ categoryId: 4, limit: 5 }),
        );
        const links = el.querySelectorAll(".preview a");
        expect(links.length).toBe(2);
        expect(links[0].getAttribute("href")).toBe("/products/10");
        expect(links[1].querySelector(".stock-LOW")?.textContent).toContain("1");
    });

    it("should not load products for an empty category", async () => {
        await render({ category: { ...wax, product_count: 0 } });

        expect(getProducts).not.toHaveBeenCalled();
        expect(el.querySelector(".preview")).toBeNull();
    });

    it("should link the low stock count to the filtered products", async () => {
        await render();

        expect(text()).toContain("13");
        const low = el.querySelector(".stock-state a.badge-warning");
        expect(low?.textContent).toContain("1 stock faible");
        expect(low?.getAttribute("href")).toBe("/products?categoryId=4&stockStatus=LOW");
        expect(text()).not.toContain("Tout est en stock");
    });

    it("should say when every product is in stock", async () => {
        await render({ category: { ...wax, low_stock_count: 0 } });

        expect(text()).toContain("Tout est en stock");
    });

    it("should not show the stock value nor the last change to the manager", async () => {
        await render();

        expect(text()).not.toContain("Valeur du stock");
        expect(text()).not.toContain("Admin Test");
    });

    it("should show the stock value and the last change to the admin", async () => {
        await render({ admin: true, category: { ...wax, ...adminExtras } });

        expect(text()).toContain("Valeur du stock");
        expect(text()).toContain("245 500 F");
        expect(text()).toContain("Modifiée le");
        expect(text()).toContain("par Admin Test");
    });

    it("should make the products link the main action for the manager", async () => {
        await render();

        expect(el.querySelector(".sheet .actions a.btn-primary")?.textContent).toContain(
            "Voir les produits",
        );
    });

    it("should not offer the products of a deleted category", async () => {
        await render({ category: { ...wax, is_active: false } });

        expect(text()).toContain("Supprimée");
        expect(el.querySelector(".sheet .actions")).toBeNull();
        expect(el.querySelector("a.count-link")).toBeNull();
    });

    it("should not offer to add, edit or delete to the manager", async () => {
        await render();

        expect(text()).not.toContain("Ajouter un produit");
        expect(el.querySelector(".manage")).toBeNull();
        expect(el.querySelector("app-product-form")).toBeNull();
    });

    it("should offer to add a product, edit and delete to the admin, even with products", async () => {
        await render({ admin: true });

        expect(el.querySelector(".sheet .actions .btn-primary")?.textContent).toContain(
            "Ajouter un produit",
        );
        expect(text()).toContain("Voir les produits");
        expect(el.querySelector(".manage")?.textContent).toContain("Modifier");
        expect(el.querySelector(".manage")?.textContent).toContain("Supprimer");
    });

    it("should offer only to add a product when the category is empty", async () => {
        await render({ admin: true, category: { ...wax, product_count: 0 } });

        expect(text()).toContain("Ajouter un produit");
        expect(text()).not.toContain("Voir les produits");
        expect(el.querySelector("a.count-link")).toBeNull();
    });

    it("should let the admin add a missing description", async () => {
        await render({ admin: true, category: { ...wax, description: null } });

        expect(text()).toContain("Ajouter une description");
        expect(text()).not.toContain("Aucune description");
    });

    it("should let the admin restore a deleted category", async () => {
        await render({ admin: true, category: { ...wax, is_active: false } });

        const button = [...el.querySelectorAll("button")].find((b) =>
            b.textContent?.includes("Restaurer la catégorie"),
        );
        expect(button).toBeTruthy();
        expect(el.querySelector(".manage")).toBeNull();

        button!.click();
        await fixture.whenStable();
        expect(restoreCategory).toHaveBeenCalledWith(4);
        // la fiche est rechargée pour afficher la catégorie active
        expect(getCategory).toHaveBeenCalledTimes(2);
    });

    it("should not offer the restore to the manager", async () => {
        await render({ category: { ...wax, is_active: false } });

        expect(text()).not.toContain("Restaurer");
    });

    it("should say when the category does not exist, without calling the backend for a bad id", async () => {
        await render({ status: 404 });
        expect(text()).toContain("Cette catégorie est introuvable.");

        TestBed.resetTestingModule();
        await render({ id: "abc" });
        expect(getCategory).not.toHaveBeenCalled();
        expect(text()).toContain("Cette catégorie est introuvable.");
    });
});

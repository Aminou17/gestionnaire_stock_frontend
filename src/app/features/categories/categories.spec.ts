import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Categories } from "./categories";
import { AuthService } from "../../core/auth/auth.service";
import { Category } from "../../core/stock/category.model";
import { CategoryService } from "../../core/stock/category.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const categories: Category[] = [
    {
        id: 1,
        name: "Bazin riche",
        description: null,
        is_active: true,
        created_at: null,
        product_count: 3,
    },
    {
        id: 2,
        name: "Pagnes",
        description: null,
        is_active: true,
        created_at: null,
        product_count: 0,
    },
    {
        id: 3,
        name: "Ancienne",
        description: null,
        is_active: false,
        created_at: null,
        product_count: 0,
    },
];

describe("Categories", () => {
    let fixture: ComponentFixture<Categories>;
    let el: HTMLElement;
    let service: Record<string, ReturnType<typeof vi.fn>>;

    async function render(isAdmin = true, list = categories) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        service = {
            getCategories: vi.fn(() => of(list)),
            createCategory: vi.fn(() =>
                of({ id: 4, name: "Wax", is_active: true, product_count: 0 }),
            ),
            updateCategory: vi.fn(() => of(list[0])),
            deleteCategory: vi.fn(() => of({ message: "ok" })),
        };

        await TestBed.configureTestingModule({
            imports: [Categories],
            providers: [
                provideRouter([]),
                { provide: CategoryService, useValue: service },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Categories);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");
    const rows = () => [...el.querySelectorAll<HTMLElement>(".row")];

    async function typeName(value: string) {
        const input = el.querySelector<HTMLInputElement>("dialog input")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        el.querySelector<HTMLButtonElement>("dialog button[type='submit']")!.click();
        await fixture.whenStable();
    }

    it("should list the active categories with their product count", async () => {
        await render();

        expect(rows().length).toBe(2);
        expect(text()).toContain("3 produits");
        expect(text()).toContain("Aucun produit");
        expect(text()).not.toContain("Ancienne");
    });

    it("should show the deleted categories only to the admin, in their own tab", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".chip")[1].click();
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Supprimée");

        TestBed.resetTestingModule();
        await render(
            false,
            categories.filter((c) => c.is_active),
        );
        expect(el.querySelector(".chips")).toBeNull();
        expect(el.querySelector(".more-btn")).toBeNull();
        expect(el.querySelector(".new-category")).toBeNull();
    });

    it("should filter the list as the user types", async () => {
        await render();
        const search = el.querySelector<HTMLInputElement>(".search input")!;
        search.value = "pag";
        search.dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Pagnes");
    });

    it("should open the page of a category", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
        rows()[0].click();

        expect(navigate).toHaveBeenCalledWith(["/categories", 1]);
    });

    it("should create a category with a trimmed name and refuse an empty one", async () => {
        await render();
        el.querySelector<HTMLButtonElement>(".new-category")!.click();

        await typeName("   ");
        expect(service["createCategory"]).not.toHaveBeenCalled();
        expect(text()).toContain("Le nom est obligatoire.");

        await typeName("  Wax ");
        expect(service["createCategory"]).toHaveBeenCalledWith("Wax", null);
        expect(service["getCategories"]).toHaveBeenCalledTimes(2);
    });

    it("should show the backend message for a duplicate name", async () => {
        await render();
        service["createCategory"].mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 409,
                        error: { message: "Une catégorie avec ce nom existe déjà." },
                    }),
            ),
        );
        el.querySelector<HTMLButtonElement>(".new-category")!.click();
        await typeName("Pagnes");

        expect(text()).toContain("Une catégorie avec ce nom existe déjà.");
    });

    it("should rename a category from its menu", async () => {
        await render();
        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".menu button")!.click();
        await fixture.whenStable();

        expect(el.querySelector<HTMLInputElement>("dialog input")!.value).toBe("Bazin riche");
        await typeName("Bazin");
        expect(service["updateCategory"]).toHaveBeenCalledWith(1, "Bazin", null);
    });

    it("should explain that a category with products cannot be deleted", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".more-btn")[0].click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".menu .danger")!.click();
        await fixture.whenStable();

        expect(text()).toContain("contient 3 produits");
        expect(el.querySelector("dialog .btn-danger")).toBeNull();
    });

    it("should delete an empty category", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".more-btn")[1].click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".menu .danger")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();

        expect(service["deleteCategory"]).toHaveBeenCalledWith(2);
    });
});

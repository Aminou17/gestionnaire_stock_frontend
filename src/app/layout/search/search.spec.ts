import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { of } from "rxjs";
import { vi } from "vitest";

import { AuthService } from "../../core/auth/auth.service";
import { ProductService } from "../../core/stock/product.service";
import { LayoutService } from "../layout.service";
import { Search } from "./search";

describe("Search", () => {
    const getProducts = vi.fn();

    async function render(isAdmin = true) {
        getProducts.mockReset();
        getProducts.mockReturnValue(
            of({ data: [{ id: 7, name: "Savon noir", theoretical_stock: 4 }], total: 1 }),
        );
        await TestBed.configureTestingModule({
            imports: [Search],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isAdmin: () => isAdmin } },
                { provide: ProductService, useValue: { getProducts } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Search);
        await fixture.whenStable();
        return fixture;
    }

    const press = (key: string, extra: KeyboardEventInit = {}) =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key, ...extra }));

    it("should open with Ctrl+K and close with Escape", async () => {
        const fixture = await render();
        const layout = TestBed.inject(LayoutService);

        press("k", { ctrlKey: true });
        await fixture.whenStable();
        expect(layout.searchOpen()).toBe(true);
        expect(fixture.nativeElement.querySelector(".palette")).not.toBeNull();

        press("Escape");
        await fixture.whenStable();
        expect(layout.searchOpen()).toBe(false);
    });

    it("should find a page without accents and go to it with Enter", async () => {
        const fixture = await render();
        const router = TestBed.inject(Router);
        const navigate = vi.spyOn(router, "navigate").mockResolvedValue(true);
        TestBed.inject(LayoutService).searchOpen.set(true);
        await fixture.whenStable();

        fixture.componentInstance.onInput("categories");
        await fixture.whenStable();
        press("Enter");

        expect(navigate).toHaveBeenCalledWith(["/categories"]);
    });

    it("should hide admin pages from the manager", async () => {
        const fixture = await render(false);
        TestBed.inject(LayoutService).searchOpen.set(true);
        await fixture.whenStable();
        fixture.componentInstance.onInput("comptes");
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain("Aucun résultat");
    });

    it("should search products after a short pause", async () => {
        const fixture = await render();
        TestBed.inject(LayoutService).searchOpen.set(true);
        await fixture.whenStable();
        fixture.componentInstance.onInput("savon");
        await fixture.whenStable();
        await new Promise((resolve) => setTimeout(resolve, 320));
        await fixture.whenStable();

        expect(getProducts).toHaveBeenCalledTimes(1);
        expect(fixture.nativeElement.textContent).toContain("Savon noir");
    });
});

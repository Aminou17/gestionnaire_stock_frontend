import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { CategoryService } from "../../core/stock/category.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { NewInventory } from "./new-inventory";

const openInventory = {
    id: 5,
    name: "Fin de mois",
    startedAt: "2026-11-20T10:00:00Z",
    countedCount: 3,
    itemsCount: 20,
};

describe("NewInventory", () => {
    let fixture: ComponentFixture<NewInventory>;
    let el: HTMLElement;
    let router: Router;
    let start: ReturnType<typeof vi.fn>;

    async function render(open: unknown[] = [], startResult = of({ id: 9 })) {
        start = vi.fn(() => startResult);

        await TestBed.configureTestingModule({
            imports: [NewInventory],
            providers: [
                provideRouter([]),
                {
                    provide: InventoryService,
                    useValue: {
                        start,
                        getInventories: () => of({ data: open, pagination: {} }),
                    },
                },
                {
                    provide: CategoryService,
                    useValue: {
                        getCategories: () =>
                            of([
                                { id: 3, name: "Boissons", is_active: true },
                                { id: 4, name: "Vieux", is_active: false },
                            ]),
                    },
                },
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(false), isOwner: signal(false), user: signal({}) },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        fixture = TestBed.createComponent(NewInventory);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should open the counting with one gesture and go to the counting screen", async () => {
        await render();

        el.querySelector<HTMLButtonElement>(".btn-primary")!.click();

        expect(start).toHaveBeenCalledTimes(1);
        // ni nom ni catégorie : seulement la clé qui évite un doublon
        expect(start.mock.calls[0][0]).toEqual({ clientKey: expect.any(String) });
        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 9, "count"], {
            replaceUrl: true,
        });
    });

    it("should keep the name and the category folded until asked", async () => {
        await render();

        expect(el.querySelector("input[type=text]")).toBeNull();

        el.querySelector<HTMLButtonElement>(".options-toggle")!.click();
        fixture.detectChanges();

        expect(el.querySelector("input[type=text]")).not.toBeNull();
        // une catégorie désactivée ne se compte pas
        expect(el.querySelectorAll("select option").length).toBe(2);
    });

    it("should send the name and the category when they are filled", async () => {
        await render();
        fixture.componentInstance.name.set("  Rayon du fond ");
        fixture.componentInstance.categoryId.set(3);

        fixture.componentInstance.start();

        expect(start.mock.calls[0][0]).toMatchObject({ name: "Rayon du fond", categoryId: 3 });
    });

    it("should propose to resume the counting already in progress", async () => {
        await render([openInventory]);

        expect(el.textContent).toContain("Un comptage est déjà en cours");
        expect(el.textContent).toContain("Fin de mois");
        expect(el.querySelector("a.btn-primary")?.getAttribute("href")).toBe(
            "/inventories/5/count",
        );
        expect(el.querySelector("button.btn-primary")).toBeNull();
    });

    it("should propose to resume when the server answers that one is in progress", async () => {
        const conflict = new HttpErrorResponse({
            status: 409,
            error: {
                code: "INVENTORY_IN_PROGRESS",
                existing: { id: 8, name: "Test", status: "in_progress" },
            },
        });
        await render([], throwError(() => conflict) as never);

        fixture.componentInstance.start();
        fixture.detectChanges();

        expect(el.querySelector("a.btn-primary")?.getAttribute("href")).toBe(
            "/inventories/8/count",
        );
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("should show the message of any other refusal", async () => {
        const refusal = new HttpErrorResponse({
            status: 400,
            error: { message: "Aucun produit à compter." },
        });
        await render([], throwError(() => refusal) as never);

        fixture.componentInstance.start();
        fixture.detectChanges();

        expect(el.querySelector("[role=alert]")?.textContent).toContain("Aucun produit à compter.");
    });
});

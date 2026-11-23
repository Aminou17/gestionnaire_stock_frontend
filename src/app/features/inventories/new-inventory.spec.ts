import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { NewInventory } from "./new-inventory";

describe("NewInventory", () => {
    let fixture: ComponentFixture<NewInventory>;
    let el: HTMLElement;
    let router: Router;
    let start: ReturnType<typeof vi.fn>;

    async function render(startResult = of({ id: 9 })) {
        start = vi.fn(() => startResult);

        await TestBed.configureTestingModule({
            imports: [NewInventory],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { start } },
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

    it("should open the counting at once, without any form, and go to the counting screen", async () => {
        await render();

        expect(start).toHaveBeenCalledTimes(1);
        expect(start.mock.calls[0][0]).toEqual({ clientKey: expect.any(String) });
        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 9, "count"], {
            replaceUrl: true,
        });
        expect(el.querySelector("input")).toBeNull();
    });

    it("should resume the counting already open instead of creating another one", async () => {
        const conflict = new HttpErrorResponse({
            status: 409,
            error: {
                code: "INVENTORY_IN_PROGRESS",
                existing: { id: 5, name: "Fin de mois", status: "in_progress" },
            },
        });
        await render(throwError(() => conflict) as never);

        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 5, "count"], {
            replaceUrl: true,
        });
    });

    it("should show the error and let the user try again", async () => {
        await render(
            throwError(
                () =>
                    new HttpErrorResponse({ status: 500, error: { message: "Panne du serveur." } }),
            ) as never,
        );

        expect(el.textContent).toContain("Panne du serveur.");

        start.mockReturnValue(of({ id: 12 }));
        el.querySelector<HTMLButtonElement>(".btn-primary")!.click();

        expect(start).toHaveBeenCalledTimes(2);
        expect(router.navigate).toHaveBeenLastCalledWith(["/inventories", 12, "count"], {
            replaceUrl: true,
        });
    });
});

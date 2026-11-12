import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { Sidebar } from "./sidebar";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

describe("Sidebar", () => {
    async function render(isAdmin: boolean, alertCount = 0) {
        await TestBed.configureTestingModule({
            imports: [Sidebar],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isAdmin: signal(isAdmin) } },
                { provide: LowStockAlertService, useValue: { count: signal(alertCount) } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Sidebar);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    const labels = (el: HTMLElement) =>
        [...el.querySelectorAll("nav a > span:not(.count)")].map((s) => s.textContent);

    it("should show every page to the admin with the alert count", async () => {
        const el = await render(true, 5);

        expect(labels(el)).toContain("Utilisateurs");
        expect(el.querySelector(".count")?.textContent).toBe("5");
    });

    it("should hide admin-only pages from the manager", async () => {
        const el = await render(false);

        expect(labels(el)).toEqual([
            "Tableau de bord",
            "Ventes",
            "Caisse",
            "Produits",
            "Catégories",
            "Mouvements",
            "Paramètres",
        ]);
    });
});

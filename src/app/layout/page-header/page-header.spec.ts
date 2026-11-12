import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { PageHeader } from "./page-header";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

describe("PageHeader", () => {
    let fixture: ComponentFixture<PageHeader>;
    let el: HTMLElement;
    let logout: ReturnType<typeof vi.fn>;

    async function render(isAdmin: boolean) {
        logout = vi.fn();
        await TestBed.configureTestingModule({
            imports: [PageHeader],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({
                            id: 1,
                            name: "Yabre Moussa",
                            email: "yabre@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                        logout,
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(3) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PageHeader);
        fixture.componentRef.setInput("title", "Tableau de bord");
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should show the title, the initials and the role", async () => {
        await render(true);

        expect(el.querySelector("h1")?.textContent).toBe("Tableau de bord");
        expect(el.querySelector(".avatar")?.textContent).toBe("YM");
        expect(el.querySelector(".user-info small")?.textContent).toBe("Propriétaire");
    });

    it("should show the alert bell only to the admin", async () => {
        await render(false);
        expect(el.querySelector('a[aria-label="Alertes de stock"]')).toBeNull();
    });

    it("should open the user menu, log out, and close the menu on an outside click", async () => {
        await render(true);

        el.querySelector<HTMLButtonElement>(".user-btn")!.click();
        await fixture.whenStable();
        expect(el.querySelector(".dropdown")).not.toBeNull();

        document.body.click();
        await fixture.whenStable();
        expect(el.querySelector(".dropdown")).toBeNull();

        el.querySelector<HTMLButtonElement>(".user-btn")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".dropdown button")!.click();
        expect(logout).toHaveBeenCalled();
    });
});

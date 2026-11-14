import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { PageHeader } from "./page-header";
import { AuthService } from "../../core/auth/auth.service";
import { SecurityAlertService } from "../../core/audit/security-alert.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

describe("PageHeader", () => {
    let fixture: ComponentFixture<PageHeader>;
    let el: HTMLElement;

    async function render(isAdmin: boolean, isOwner = false) {
        await TestBed.configureTestingModule({
            imports: [PageHeader],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(isOwner),
                        user: signal({
                            id: 1,
                            name: "Yabre Moussa",
                            email: "yabre@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(3) } },
                {
                    provide: SecurityAlertService,
                    useValue: { count: signal(0), latest: signal([]), reload: vi.fn() },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PageHeader);
        fixture.componentRef.setInput("title", "Tableau de bord");
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should show the title", async () => {
        await render(true);

        expect(el.querySelector("h1")?.textContent).toBe("Tableau de bord");
    });

    it("should link the profile picture to the account page", async () => {
        await render(false);

        const link = el.querySelector<HTMLAnchorElement>("a.me");
        expect(link?.getAttribute("href")).toBe("/settings/account");
        expect(link?.querySelector("img")?.getAttribute("src")).toBe("/avatar-default.png");
    });

    it("should show the notification bell to the admin", async () => {
        await render(true);
        expect(el.querySelector("app-notifications")).not.toBeNull();
    });

    it("should show the alert bell only to the admin", async () => {
        await render(false);
        expect(el.querySelector("app-notifications")).toBeNull();
    });

    it("should hide the shop menu and profile from the owner", async () => {
        await render(false, true);
        expect(el.querySelector(".menu-btn")).toBeNull();
        expect(el.querySelector("a.me")).toBeNull();
    });
});

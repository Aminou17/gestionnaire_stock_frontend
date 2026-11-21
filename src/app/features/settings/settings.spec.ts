import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
import { CashSettingsService } from "../../core/cash/cash-settings.service";
import { SalesSettingsService } from "../../core/sales/sales-settings.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { AlertEmailService } from "../../core/stock/alert-email.service";
import { StockSettingsService } from "../../core/stock/stock-settings.service";
import { Settings } from "./settings";

describe("Settings", () => {
    let fixture: ComponentFixture<Settings>;
    let el: HTMLElement;
    const theme = signal("dark");
    const toggle = vi.fn();

    async function render(isAdmin = true) {
        await TestBed.configureTestingModule({
            imports: [Settings],
            providers: [
                provideRouter([]),
                {
                    provide: ShopSettingsService,
                    useValue: { getSettings: () => of({ name: "Chez Awa", logo: null }) },
                },
                {
                    provide: StockSettingsService,
                    useValue: { getSettings: () => of({ id: 1, min_stock: 5 }) },
                },
                {
                    provide: AlertEmailService,
                    useValue: { getSettings: () => of({ enabled: true, sendHour: 8 }) },
                },
                {
                    provide: CashSettingsService,
                    useValue: { getSettings: () => of({ blind_close: false }) },
                },
                {
                    provide: SalesSettingsService,
                    useValue: { getSettings: () => of({ ticket_prefix: "" }) },
                },
                { provide: ThemeService, useValue: { theme, toggle } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Awa Traoré",
                            email: "awa@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Administrateur"),
                        logoutAsked: signal(false),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Settings);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const hrefs = () =>
        [...el.querySelectorAll<HTMLAnchorElement>("a.item")].map((a) => a.getAttribute("href"));

    it("should show the connected user", async () => {
        await render();

        const profile = el.querySelector(".profile")!.textContent!;

        expect(profile).toContain("awa@test.com");
        expect(profile).toContain("Administrateur");
    });

    it("should link to every settings page for the owner", async () => {
        await render();

        expect(hrefs()).toEqual([
            "/shop",
            "/stock",
            "/alert-email",
            "/cash",
            "/sales",
            "/export",
            "/account",
            "/password",
            "/subscription",
            "/contact",
            "/privacy",
            "/terms",
            "/settings/install",
        ]);
    });

    it("should only offer the account to the manager", async () => {
        await render(false);

        expect(hrefs()).toEqual([
            "/account",
            "/password",
            "/contact",
            "/privacy",
            "/terms",
            "/settings/install",
        ]);
    });

    it("should show the state of the main settings for the administrator", async () => {
        await render();

        const text = el.textContent!;

        expect(text).not.toContain("Chez Awa");
        expect(text).toContain("Seuil : 5");
        expect(text).toContain("Activé à 08:00");
        expect(text).toContain("Essai gratuit");
    });

    it("should not read the settings for the manager", async () => {
        await render(false);

        expect(el.querySelector(".status")).toBeNull();
    });

    it("should ask to log out", async () => {
        await render();
        const logoutAsked = TestBed.inject(AuthService).logoutAsked;

        el.querySelector<HTMLButtonElement>(".logout")!.click();

        expect(logoutAsked()).toBe(true);
    });

    it("should show the dark mode as a switch and toggle it from the page", async () => {
        await render();
        const toggleButton = el.querySelector<HTMLButtonElement>(".theme-toggle")!;

        expect(toggleButton.textContent).toContain("Mode sombre");
        expect(toggleButton.getAttribute("aria-checked")).toBe("true");

        toggleButton.click();

        expect(toggle).toHaveBeenCalled();
    });
});

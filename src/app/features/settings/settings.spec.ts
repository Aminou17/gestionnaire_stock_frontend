import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { Settings } from "./settings";

describe("Settings", () => {
    let fixture: ComponentFixture<Settings>;
    let el: HTMLElement;
    const theme = signal("dark");
    const toggle = vi.fn();

    let subscriptionsOpen = false;

    async function render(isAdmin = true) {
        await TestBed.configureTestingModule({
            imports: [Settings],
            providers: [
                provideRouter([]),
                {
                    provide: ShopSettingsService,
                    useValue: {
                        subscriptionsEnabled: () => subscriptionsOpen,
                    },
                },
                { provide: ThemeService, useValue: { theme, toggle } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Adam Traoré",
                            email: "adam@test.com",
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

        expect(profile).toContain("adam@test.com");
        expect(profile).toContain("Administrateur");
    });

    it("should link to every settings page for the owner", async () => {
        await render();

        expect(hrefs()).toEqual([
            "/shop",
            "/account",
            "/password",
            "/stock",
            "/alert-email",
            "/cash",
            "/sales",
            "/export",
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

    it("should show the Abonnement page link only when the owner has opened the subscriptions", async () => {
        subscriptionsOpen = true;
        await render();

        expect(el.textContent).toContain("Abonnement");
        expect(el.querySelector("a[href='/subscription']")).not.toBeNull();
        subscriptionsOpen = false;
    });

    it("should show nothing on the right of the settings rows", async () => {
        await render();

        expect(el.querySelector(".status")).toBeNull();
        // Le logiciel est gratuit pendant le lancement : aucune trace d'abonnement
        expect(el.textContent).not.toContain("Abonnement");
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

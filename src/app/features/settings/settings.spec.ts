import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
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
            "/receipt",
            "/stock",
            "/alert-email",
            "/cash",
            "/sales",
            "/export",
            "/account",
            "/password",
        ]);
    });

    it("should only offer the account to the manager", async () => {
        await render(false);

        expect(hrefs()).toEqual(["/account", "/password"]);
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

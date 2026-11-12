import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Settings } from "./settings";

describe("Settings", () => {
    let fixture: ComponentFixture<Settings>;
    let el: HTMLElement;

    async function render(isAdmin = true) {
        await TestBed.configureTestingModule({
            imports: [Settings],
            providers: [
                provideRouter([]),
                { provide: ThemeService, useValue: { theme: signal("dark") } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({
                            id: 1,
                            name: "Awa Traoré",
                            email: "awa@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Propriétaire"),
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

        expect(profile).toContain("AT");
        expect(profile).toContain("awa@test.com");
        expect(profile).toContain("Propriétaire");
    });

    it("should link to every settings page for the owner", async () => {
        await render();

        expect(hrefs()).toEqual([
            "/shop",
            "/receipt",
            "/stock",
            "/cash",
            "/sales",
            "/export",
            "/account",
            "/password",
            "/appearance",
        ]);
    });

    it("should only offer the account and the appearance to the manager", async () => {
        await render(false);

        expect(hrefs()).toEqual(["/account", "/password", "/appearance"]);
    });

    it("should show the current theme", async () => {
        await render();

        expect(el.textContent).toContain("Sombre");
    });
});

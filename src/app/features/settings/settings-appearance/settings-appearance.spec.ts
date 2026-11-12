import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { ThemeService } from "../../../core/theme/theme.service";
import { SettingsAppearance } from "./settings-appearance";

describe("SettingsAppearance", () => {
    let fixture: ComponentFixture<SettingsAppearance>;
    let el: HTMLElement;
    let theme: ReturnType<typeof signal<"light" | "dark">>;

    beforeEach(async () => {
        theme = signal<"light" | "dark">("light");

        await TestBed.configureTestingModule({
            imports: [SettingsAppearance],
            providers: [
                provideRouter([]),
                { provide: ThemeService, useValue: { theme } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        user: signal({ id: 1, name: "Admin", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Propriétaire"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsAppearance);
        el = fixture.nativeElement;
        await fixture.whenStable();
    });

    const radio = (value: string) =>
        el.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!;

    it("should select the current theme", () => {
        expect(radio("light").checked).toBe(true);
        expect(radio("dark").checked).toBe(false);
    });

    it("should switch to the dark theme", async () => {
        radio("dark").click();
        await fixture.whenStable();

        expect(theme()).toBe("dark");
        expect(el.querySelector(".theme-option.selected")!.textContent).toContain("Sombre");
    });
});

import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { SettingsAccount } from "./settings-account";

describe("SettingsAccount", () => {
    let fixture: ComponentFixture<SettingsAccount>;
    let el: HTMLElement;
    let updateProfile: ReturnType<typeof vi.fn>;
    const user = signal({ id: 1, name: "Awa Traoré", email: "awa@test.com", role: "manager" });

    async function render() {
        user.set({ id: 1, name: "Awa Traoré", email: "awa@test.com", role: "manager" });
        updateProfile = vi.fn((name: string, email: string) => {
            user.set({ ...user(), name, email });
            return of(user());
        });

        await TestBed.configureTestingModule({
            imports: [SettingsAccount],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        user,
                        isAdmin: signal(false),
                        roleLabel: signal("Gérant"),
                        updateProfile,
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsAccount);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const field = (name: string) =>
        el.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;

    async function type(name: string, value: string) {
        field(name).value = value;
        field(name).dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function submit(index: number) {
        el.querySelectorAll<HTMLFormElement>("form")[index].dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    }

    it("should show the current profile and the role", async () => {
        await render();

        expect(field("name").value).toBe("Awa Traoré");
        expect(field("email").value).toBe("awa@test.com");
        expect(el.textContent).toContain("Gérant");
    });

    it("should save the profile with the email in lowercase", async () => {
        await render();

        await type("name", "Awa B.");
        await type("email", "Awa.B@Test.com");
        await submit(0);

        expect(updateProfile).toHaveBeenCalledWith("Awa B.", "awa.b@test.com");
        expect(el.textContent).toContain("Profil enregistré.");
    });

    it("should not save a profile without a name", async () => {
        await render();

        await type("name", "");
        await submit(0);

        expect(updateProfile).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Le nom est obligatoire.");
    });

    it("should restore the profile on cancel", async () => {
        await render();

        await type("name", "Autre nom");
        el.querySelector<HTMLButtonElement>("form .btn-outline")!.click();
        await fixture.whenStable();

        expect(field("name").value).toBe("Awa Traoré");
    });

    it("should leave without question when nothing changed", async () => {
        await render();

        expect(fixture.componentInstance.canLeave()).toBe(true);
    });
});

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
    const user = signal<Record<string, unknown>>({
        id: 1,
        name: "Awa Traoré",
        firstName: "Awa",
        lastName: "Traoré",
        email: "awa@test.com",
        role: "manager",
    });

    async function render() {
        user.set({
            id: 1,
            name: "Awa Traoré",
            firstName: "Awa",
            lastName: "Traoré",
            email: "awa@test.com",
            role: "manager",
        });
        updateProfile = vi.fn((firstName: string, lastName: string, email: string) => {
            user.set({ ...user(), name: `${firstName} ${lastName}`, firstName, lastName, email });
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
                        isOwner: signal(false),
                        roleLabel: signal("Employé"),
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

        expect(field("firstName").value).toBe("Awa");
        expect(field("lastName").value).toBe("Traoré");
        expect(field("email").value).toBe("awa@test.com");
        expect(el.textContent).toContain("Employé");
    });

    it("should save the profile with the email in lowercase", async () => {
        await render();

        await type("firstName", " Awa ");
        await type("lastName", "Bazin");
        await type("email", "Awa.B@Test.com");
        await submit(0);

        expect(updateProfile).toHaveBeenCalledWith("Awa", "Bazin", "awa.b@test.com");
        expect(el.textContent).toContain("Profil enregistré.");
    });

    it("should not save a profile without a first name", async () => {
        await render();

        await type("firstName", "");
        await submit(0);

        expect(updateProfile).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Le prénom est obligatoire.");
    });

    it("should show the full name in the header while typing", async () => {
        await render();

        await type("firstName", "Aïcha");

        expect(el.querySelector(".identity-name")?.textContent).toContain("Aïcha Traoré");
    });

    it("should split the full name of a session opened before first and last names", async () => {
        await render();
        TestBed.resetTestingModule();
        user.set({ id: 1, name: "Jean Marc Bakala", email: "j@test.com", role: "manager" });
        await TestBed.configureTestingModule({
            imports: [SettingsAccount],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        user,
                        isAdmin: signal(false),
                        isOwner: signal(false),
                        roleLabel: signal("Employé"),
                        updateProfile,
                    },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(SettingsAccount);
        el = fixture.nativeElement;
        await fixture.whenStable();

        expect(field("firstName").value).toBe("Jean Marc");
        expect(field("lastName").value).toBe("Bakala");
    });

    it("should restore the profile on cancel", async () => {
        await render();

        await type("firstName", "Autre");
        el.querySelector<HTMLButtonElement>("form .btn-outline")!.click();
        await fixture.whenStable();

        expect(field("firstName").value).toBe("Awa");
    });

    it("should leave without question when nothing changed", async () => {
        await render();

        expect(fixture.componentInstance.canLeave()).toBe(true);
    });
});

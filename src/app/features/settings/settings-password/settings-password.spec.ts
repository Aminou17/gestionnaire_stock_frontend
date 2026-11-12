import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { SettingsPassword } from "./settings-password";

describe("SettingsPassword", () => {
    let fixture: ComponentFixture<SettingsPassword>;
    let el: HTMLElement;
    let changePassword: ReturnType<typeof vi.fn>;

    async function render(passwordError?: string) {
        changePassword = vi.fn(() =>
            passwordError
                ? throwError(
                      () =>
                          new HttpErrorResponse({ status: 400, error: { message: passwordError } }),
                  )
                : of({ message: "ok" }),
        );

        await TestBed.configureTestingModule({
            imports: [SettingsPassword],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        user: signal(null),
                        isAdmin: signal(false),
                        roleLabel: signal("Gérant"),
                        changePassword,
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsPassword);
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

    it("should change the password and empty the fields", async () => {
        await render();

        await type("currentPassword", "ancien-mdp");
        await type("newPassword", "nouveau-mdp");
        await type("confirmPassword", "nouveau-mdp");
        await submit(0);

        expect(changePassword).toHaveBeenCalledWith("ancien-mdp", "nouveau-mdp");
        expect(el.textContent).toContain("Mot de passe modifié.");
        expect(field("newPassword").value).toBe("");
    });

    it("should refuse a short password", async () => {
        await render();

        await type("currentPassword", "ancien-mdp");
        await type("newPassword", "court");
        await type("confirmPassword", "court");
        await submit(0);

        expect(changePassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("au moins 8 caractères");
    });

    it("should refuse two different passwords", async () => {
        await render();

        await type("currentPassword", "ancien-mdp");
        await type("newPassword", "nouveau-mdp");
        await type("confirmPassword", "autre-chose");
        await submit(0);

        expect(changePassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Les deux mots de passe sont différents.");
    });

    it("should show the backend message when the current password is wrong", async () => {
        await render("Le mot de passe actuel est incorrect.");

        await type("currentPassword", "mauvais-mdp");
        await type("newPassword", "nouveau-mdp");
        await type("confirmPassword", "nouveau-mdp");
        await submit(0);

        expect(el.textContent).toContain("Le mot de passe actuel est incorrect.");
    });

    it("should leave without question when nothing changed", async () => {
        await render();

        expect(fixture.componentInstance.canLeave()).toBe(true);
    });
});

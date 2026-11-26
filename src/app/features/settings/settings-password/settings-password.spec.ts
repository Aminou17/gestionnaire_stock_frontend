import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { SettingsPassword } from "./settings-password";

describe("SettingsPassword", () => {
    let fixture: ComponentFixture<SettingsPassword>;
    let el: HTMLElement;
    let changePassword: ReturnType<typeof vi.fn>;
    let forgotPassword: ReturnType<typeof vi.fn>;
    let logoutAll: ReturnType<typeof vi.fn>;
    let router: Router;

    async function render(passwordError?: string, mustChangePassword = false) {
        changePassword = vi.fn(() =>
            passwordError
                ? throwError(
                      () =>
                          new HttpErrorResponse({ status: 400, error: { message: passwordError } }),
                  )
                : of({ message: "ok" }),
        );

        forgotPassword = vi.fn(() => of({ message: "ok" }));
        logoutAll = vi.fn(() => of({}));

        await TestBed.configureTestingModule({
            imports: [SettingsPassword],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        user: signal({ email: "adam@test.com", mustChangePassword }),
                        isAdmin: signal(false),
                        isOwner: signal(false),
                        roleLabel: signal("Employé"),
                        changePassword,
                        forgotPassword,
                        logoutAll,
                    },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);

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

    it("should show the temporary password notice only with the flag", async () => {
        await render();

        expect(el.textContent).not.toMatch(/provisoire/i);
    });

    it("should show the temporary password notice when the flag is set", async () => {
        await render(undefined, true);

        expect(el.textContent).toMatch(/provisoire/i);
    });

    it("should go to the dashboard after a successful change with the flag", async () => {
        await render(undefined, true);

        await type("currentPassword", "ancien-mdp");
        await type("newPassword", "nouveau-mdp");
        await type("confirmPassword", "nouveau-mdp");
        await submit(0);

        expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
    });

    it("should stay on the page after a successful change without the flag", async () => {
        await render();

        await type("currentPassword", "ancien-mdp");
        await type("newPassword", "nouveau-mdp");
        await type("confirmPassword", "nouveau-mdp");
        await submit(0);

        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("should send the reset link to the account e-mail", async () => {
        await render();

        el.querySelector<HTMLButtonElement>(".forgot")!.click();
        await fixture.whenStable();

        expect(forgotPassword).toHaveBeenCalledWith("adam@test.com");
        expect(el.textContent).toContain("Un lien vous a été envoyé par e-mail.");
    });

    const buttonByText = (text: string) =>
        Array.from(el.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
            b.textContent?.includes(text),
        );

    async function click(text: string) {
        buttonByText(text)!.click();
        await fixture.whenStable();
    }

    it("should ask for a confirmation before logging out everywhere", async () => {
        await render();

        await click("Me déconnecter partout");

        expect(logoutAll).not.toHaveBeenCalled();
        expect(buttonByText("Oui, tout fermer")).toBeTruthy();
        expect(buttonByText("Me déconnecter partout")).toBeUndefined();
    });

    it("should go back to the first button when the confirmation is cancelled", async () => {
        await render();

        await click("Me déconnecter partout");
        await click("Annuler");

        expect(logoutAll).not.toHaveBeenCalled();
        expect(buttonByText("Me déconnecter partout")).toBeTruthy();
        expect(buttonByText("Oui, tout fermer")).toBeUndefined();
    });

    it("should log out everywhere after the second click", async () => {
        await render();

        await click("Me déconnecter partout");
        await click("Oui, tout fermer");

        expect(logoutAll).toHaveBeenCalledTimes(1);
    });

    it("should show the backend message when logging out everywhere fails", async () => {
        await render();
        logoutAll.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 500, error: { message: "Erreur serveur." } }),
            ),
        );

        await click("Me déconnecter partout");
        await click("Oui, tout fermer");

        expect(el.querySelector(".alert-error")?.textContent).toContain("Erreur serveur.");
        // La confirmation reste ouverte avec l'erreur près des boutons
        expect(buttonByText("Oui, tout fermer")).toBeTruthy();
    });
});

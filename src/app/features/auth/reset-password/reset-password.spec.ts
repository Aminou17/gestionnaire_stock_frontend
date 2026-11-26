import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { ResetPassword } from "./reset-password";
import { AuthService } from "../../../core/auth/auth.service";

describe("ResetPassword", () => {
    let fixture: ComponentFixture<ResetPassword>;
    let component: ResetPassword;
    let el: HTMLElement;
    let auth: { resetPassword: ReturnType<typeof vi.fn>; endSession: ReturnType<typeof vi.fn> };

    async function setup(token: string | null) {
        auth = { resetPassword: vi.fn(), endSession: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [ResetPassword],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: auth },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParamMap: new Map(token ? [["token", token]] : []) },
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ResetPassword);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    async function submit(newPassword: string, confirmPassword: string) {
        component.form.patchValue({ newPassword, confirmPassword });
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should say the link is no longer valid without a token in the URL", async () => {
        await setup(null);

        expect(el.textContent).toContain("Ce lien n'est plus valable");
        expect(el.querySelector("form")).toBeNull();
    });

    it("should refuse two different passwords without calling the API", async () => {
        await setup("a".repeat(64));

        await submit("Motdepasse-2026", "Autre-2026-mdp");

        expect(auth.resetPassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Les deux mots de passe ne sont pas identiques.");
    });

    it("should refuse a password that is too short without calling the API", async () => {
        await setup("a".repeat(64));

        await submit("court", "court");

        expect(auth.resetPassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Entre 8 et 72 caractères.");
    });

    it("should send the token and the new password, then show the success title", async () => {
        await setup("a".repeat(64));
        auth.resetPassword.mockReturnValue(of({ message: "ok" }));

        await submit("Motdepasse-2026", "Motdepasse-2026");

        expect(auth.resetPassword).toHaveBeenCalledWith("a".repeat(64), "Motdepasse-2026");
        // Une session déjà ouverte sur l'appareil est fermée
        expect(auth.endSession).toHaveBeenCalled();
        expect(el.textContent).toContain("Mot de passe modifié");
    });

    it("should offer a new link when a 400 error talks about the link", async () => {
        await setup("a".repeat(64));
        auth.resetPassword.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: { message: "Ce lien n'est plus valable. Demandez-en un nouveau." },
                    }),
            ),
        );

        await submit("Motdepasse-2026", "Motdepasse-2026");

        expect(el.textContent).toContain("Demander un nouveau lien");
    });

    it("should show another API error in the form", async () => {
        await setup("a".repeat(64));
        auth.resetPassword.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 429,
                        error: { message: "Trop de tentatives, réessayez dans 15 minutes." },
                    }),
            ),
        );

        await submit("Motdepasse-2026", "Motdepasse-2026");

        expect(el.textContent).toContain("Trop de tentatives, réessayez dans 15 minutes.");
        expect(el.textContent).not.toContain("Demander un nouveau lien");
    });
});

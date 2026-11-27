import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Login } from "./login";
import { AuthService } from "../../../core/auth/auth.service";
import { GoogleSignIn } from "../../../core/auth/google-sign-in";

describe("Login", () => {
    let fixture: ComponentFixture<Login>;
    let component: Login;
    let el: HTMLElement;
    let auth: {
        login: ReturnType<typeof vi.fn>;
        verifyTwoFactor: ReturnType<typeof vi.fn>;
        loginWithGoogle: ReturnType<typeof vi.fn>;
        isOwner: () => boolean;
        user: () => { mustChangePassword?: boolean } | null;
    };
    let router: Router;

    beforeEach(async () => {
        auth = {
            login: vi.fn(),
            verifyTwoFactor: vi.fn(),
            loginWithGoogle: vi.fn(),
            isOwner: () => false,
            user: () => null,
        };

        await TestBed.configureTestingModule({
            imports: [Login],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: auth },
                {
                    provide: GoogleSignIn,
                    useValue: { load: () => Promise.resolve(null), onCredential: () => {} },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Login);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        await fixture.whenStable();
    });

    function fillForm(email = "adam@test.com", password = "secret") {
        component.form.patchValue({ email, password });
    }

    async function submit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should create", () => {
        expect(component).toBeTruthy();
    });

    it("should not show any error when leaving an empty field before sending", async () => {
        component.form.markAllAsTouched();
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector(".field-error")).toBeNull();
    });

    it("should show validation errors and not call the API when the form is empty", async () => {
        await submit();

        expect(auth.login).not.toHaveBeenCalled();
        expect(el.textContent).toContain("L'adresse e-mail est obligatoire.");
        expect(el.textContent).toContain("Le mot de passe est obligatoire.");
    });

    it("should reject an invalid email", async () => {
        fillForm("pas-un-email");
        await submit();

        expect(auth.login).not.toHaveBeenCalled();
        expect(el.textContent).toContain("L'adresse e-mail n'est pas valide.");
    });

    it("should login and redirect to the dashboard", async () => {
        auth.login.mockReturnValue(of({}));
        fillForm();
        await submit();

        expect(auth.login).toHaveBeenCalledWith("adam@test.com", "secret", true);
        expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
    });

    it("should send the owner to the list of shops", async () => {
        auth.login.mockReturnValue(of({}));
        auth.isOwner = () => true;
        fillForm();
        await submit();

        expect(auth.login).toHaveBeenCalledWith("adam@test.com", "secret", true);
        expect(router.navigate).toHaveBeenCalledWith(["/owner"]);
    });

    it("should pass remember = false when the box is unchecked", async () => {
        auth.login.mockReturnValue(of({}));
        fillForm();
        component.form.controls.remember.setValue(false);
        await submit();

        expect(auth.login).toHaveBeenCalledWith("adam@test.com", "secret", false);
    });

    it("should display the error message returned by the API", async () => {
        auth.login.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 401,
                        error: { message: "Email ou mot de passe incorrect." },
                    }),
            ),
        );
        fillForm();
        await submit();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain(
            "Email ou mot de passe incorrect.",
        );
        expect(component.loading()).toBe(false);
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("should display a network error when the server is unreachable", async () => {
        auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
        fillForm();
        await submit();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain(
            "Impossible de joindre le serveur",
        );
    });

    it("should toggle password visibility", async () => {
        const input = el.querySelector<HTMLInputElement>("#password")!;
        expect(input.type).toBe("password");

        el.querySelector<HTMLButtonElement>(".toggle")!.click();
        await fixture.whenStable();

        expect(input.type).toBe("text");
    });

    describe("double authentification", () => {
        async function toCodeStep() {
            auth.login.mockReturnValue(of({ twoFactorRequired: true, twoFactorToken: "jeton" }));
            fillForm();
            await submit();
        }

        it("should ask for a code after the password and not open the app", async () => {
            await toCodeStep();

            expect(component.step()).toBe("code");
            expect(router.navigate).not.toHaveBeenCalled();
            expect(el.querySelector('input[autocomplete="one-time-code"]')).toBeTruthy();
            expect(el.textContent).toContain("Utiliser un code de secours");
        });

        it("should send the token and the code, then enter the app", async () => {
            await toCodeStep();
            auth.verifyTwoFactor.mockReturnValue(of({}));

            component.codeControl.setValue("123456");
            component.submitCode();

            expect(auth.verifyTwoFactor).toHaveBeenCalledWith("jeton", "123456", true);
            expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
        });

        it("should send the code by itself once 6 digits are typed", async () => {
            await toCodeStep();
            auth.verifyTwoFactor.mockReturnValue(of({}));

            component.codeControl.setValue("123456");
            component.onCodeInput();

            expect(auth.verifyTwoFactor).toHaveBeenCalledTimes(1);
        });

        it("should show the error and empty the field after a wrong code", async () => {
            await toCodeStep();
            auth.verifyTwoFactor.mockReturnValue(
                throwError(
                    () =>
                        new HttpErrorResponse({
                            status: 401,
                            error: { message: "Code incorrect." },
                        }),
                ),
            );

            component.codeControl.setValue("000000");
            component.submitCode();
            await fixture.whenStable();

            expect(component.error()).toBe("Code incorrect.");
            expect(component.codeControl.value).toBe("");
        });

        it("should switch to the backup code field and go back to the password", async () => {
            await toCodeStep();

            component.toggleBackupCode();
            await fixture.whenStable();
            expect(el.querySelector('input[placeholder="xxxxx-xxxxx"]')).toBeTruthy();

            component.backToPassword();
            expect(component.step()).toBe("password");
        });
    });

    it("should enter the app after a Google sign-in on a known account", () => {
        auth.loginWithGoogle.mockReturnValue(of(true));

        component.onGoogle("jeton-google");

        expect(auth.loginWithGoogle).toHaveBeenCalledWith("jeton-google");
        expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
    });

    it("should send an unknown Google account to the shop creation", () => {
        auth.loginWithGoogle.mockReturnValue(of(false));

        component.onGoogle("jeton-google");

        expect(router.navigate).toHaveBeenCalledWith(["/register"]);
    });

    it("should show the API message when Google sign-in fails", () => {
        auth.loginWithGoogle.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 403,
                        error: { message: "Ce compte se connecte avec son mot de passe." },
                    }),
            ),
        );

        component.onGoogle("jeton-google");

        expect(component.error()).toBe("Ce compte se connecte avec son mot de passe.");
        expect(component.loading()).toBe(false);
    });
});

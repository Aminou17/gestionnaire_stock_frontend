import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { signal } from "@angular/core";
import { of, throwError } from "rxjs";

import { Register } from "./register";
import { AuthService, GoogleSignup } from "../../../core/auth/auth.service";
import { GoogleSignIn } from "../../../core/auth/google-sign-in";

describe("Register", () => {
    let fixture: ComponentFixture<Register>;
    let component: Register;
    let el: HTMLElement;
    let auth: {
        register: ReturnType<typeof vi.fn>;
        isPhoneAvailable: ReturnType<typeof vi.fn>;
        loginWithGoogle: ReturnType<typeof vi.fn>;
        registerWithGoogle: ReturnType<typeof vi.fn>;
        googleSignup: ReturnType<typeof signal<GoogleSignup | null>>;
        isOwner: () => boolean;
        isFree: ReturnType<typeof vi.fn>;
    };
    let router: Router;

    beforeEach(async () => {
        auth = {
            register: vi.fn(() => of({ verificationRequired: true, email: "fatou@exemple.com" })),
            isPhoneAvailable: vi.fn(() => of({ available: true })),
            loginWithGoogle: vi.fn(),
            registerWithGoogle: vi.fn(() => of({})),
            googleSignup: signal<GoogleSignup | null>(null),
            isOwner: () => false,
            isFree: vi.fn(() => of(true)),
        };

        await TestBed.configureTestingModule({
            imports: [Register],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: auth },
                {
                    provide: GoogleSignIn,
                    useValue: { load: () => Promise.resolve(null), onCredential: () => {} },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Register);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        await fixture.whenStable();
    });

    async function submit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    function fillForm() {
        component.form.patchValue({
            adminName: "Fatou Ouédraogo",
            phone: "+226 70 12 34 56",
            email: "Fatou@Exemple.com",
            password: "Boutique-2026!",
        });
    }

    it("should ask only for the name, phone, email and password on one page", () => {
        const labels = [...el.querySelectorAll("form label, form .field > span")]
            .map((label) => label.textContent!.replace("*", "").trim())
            .filter((label) => label !== "Site web");

        expect(labels).toEqual([
            "Votre nom",
            "Numéro de téléphone",
            "Adresse e-mail",
            "Mot de passe",
        ]);
        expect(el.querySelector(".legal")?.textContent).toContain("conditions d'utilisation");
    });

    it("should say the software is free only while it is", async () => {
        expect(el.querySelector(".reassurance")?.textContent).toContain("Gratuit");

        auth.isFree.mockReturnValue(of(false));
        const paid = TestBed.createComponent(Register);
        await paid.whenStable();

        expect(paid.nativeElement.querySelector(".reassurance")).toBeNull();
    });

    it("should warn while typing when the phone number is already used", async () => {
        vi.useFakeTimers();
        auth.isPhoneAvailable.mockReturnValue(
            of({ available: false, message: "Ce numéro est déjà utilisé par une autre boutique." }),
        );

        component.form.controls.phone.setValue("+226 70 12 34 56");
        vi.advanceTimersByTime(600);
        fixture.detectChanges();
        vi.useRealTimers();

        expect(component.phoneStatus()).toBe("taken");
        expect(el.textContent).toContain("déjà utilisé");
    });

    it("should not send while the phone number is taken", async () => {
        fillForm();
        component.phoneStatus.set("taken");
        await submit();

        expect(auth.register).not.toHaveBeenCalled();
    });

    it("should show errors and not call the API when the form is empty", async () => {
        await submit();

        expect(auth.register).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Votre nom est obligatoire.");
        expect(el.textContent).toContain("Le mot de passe est obligatoire.");
    });

    it("should register with the country of the phone code and a lowercase email", async () => {
        fillForm();
        await submit();

        expect(auth.register).toHaveBeenCalledWith({
            adminName: "Fatou Ouédraogo",
            phone: "+226 70 12 34 56",
            country: "Burkina Faso",
            email: "fatou@exemple.com",
            password: "Boutique-2026!",
            website: "",
            elapsedMs: expect.any(Number),
        });
        // L'adresse se confirme avec le code reçu avant d'entrer dans la boutique
        expect(router.navigate).toHaveBeenCalledWith(["/verify-email"], {
            queryParams: { email: "fatou@exemple.com" },
        });
    });

    it("should show the API message and stay on the page", async () => {
        auth.register.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 409,
                        error: { message: "Cet email est déjà utilisé." },
                    }),
            ),
        );

        fillForm();
        await submit();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain(
            "Aucune boutique n'a été créée.",
        );
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("should validate the password rule while typing", async () => {
        component.form.patchValue({ password: "Boutique-2026!" });
        await fixture.whenStable();

        expect(el.querySelector("app-password-hint small")?.classList).toContain("met");
    });

    it("should tick the email only when it looks complete", async () => {
        component.form.patchValue({ email: "fatou@exemple" });
        await fixture.whenStable();
        expect(el.querySelector(".valid-mark")).toBeNull();

        component.form.patchValue({ email: "fatou@exemple.com" });
        await fixture.whenStable();
        expect(el.querySelector(".valid-mark")).not.toBeNull();
    });

    it("should show the success state on the button once the shop is created", async () => {
        fillForm();
        await submit();

        const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        expect(button.textContent).toContain("Boutique créée");
        expect(button.disabled).toBe(true);
    });

    describe("with a Google account", () => {
        beforeEach(async () => {
            auth.googleSignup.set({
                credential: "jeton-google",
                email: "adam@example.com",
                firstName: "Adam",
                lastName: "Ouédraogo",
            });
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it("should only ask for the phone number", () => {
            expect(el.textContent).toContain("Bienvenue Adam");
            expect(el.textContent).toContain("adam@example.com");
            expect(el.querySelector('input[type="tel"]')).not.toBeNull();
            expect(el.querySelector("#register-name")).toBeNull();
            expect(el.querySelector("#register-email")).toBeNull();
            expect(el.querySelector("#register-password")).toBeNull();
        });

        it("should create the shop with the Google credential and the phone", async () => {
            component.form.patchValue({ phone: "+226 70 12 34 56" });
            await submit();

            expect(auth.registerWithGoogle).toHaveBeenCalledWith({
                credential: "jeton-google",
                phone: "+226 70 12 34 56",
                country: "Burkina Faso",
            });
            expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
        });

        it("should not call the API without a phone number", async () => {
            await submit();

            expect(auth.registerWithGoogle).not.toHaveBeenCalled();
        });
    });
});

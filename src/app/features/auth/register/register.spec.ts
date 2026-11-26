import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Register } from "./register";
import { AuthService } from "../../../core/auth/auth.service";

describe("Register", () => {
    let fixture: ComponentFixture<Register>;
    let component: Register;
    let el: HTMLElement;
    let auth: {
        register: ReturnType<typeof vi.fn>;
        isPhoneAvailable: ReturnType<typeof vi.fn>;
    };
    let router: Router;

    beforeEach(async () => {
        auth = {
            register: vi.fn(() => of({ verificationRequired: true, email: "fatou@exemple.com" })),
            isPhoneAvailable: vi.fn(() => of({ available: true })),
        };

        await TestBed.configureTestingModule({
            imports: [Register],
            providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
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

    async function goToAccountStep() {
        component.form.patchValue({
            shopName: "Chez Fatou",
            phone: "+226 70 12 34 56",
            country: "Burkina Faso",
            city: "Ouagadougou",
        });
        await submit();
    }

    function fillAccount() {
        component.form.patchValue({
            firstName: "Fatou",
            lastName: "Ouédraogo",
            email: "Fatou@Exemple.com",
            password: "Boutique-2026!",
            confirmPassword: "Boutique-2026!",
        });
    }

    it("should start on the shop step", () => {
        expect(component.step()).toBe(1);
        expect(el.textContent).toContain("Nom de la boutique");
        expect(el.querySelector("#register-firstName")).toBeNull();
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

    it("should stay on the shop step while the phone number is taken", async () => {
        component.form.patchValue({
            shopName: "Chez Fatou",
            phone: "+226 70 12 34 56",
            country: "Burkina Faso",
            city: "Ouagadougou",
        });
        component.phoneStatus.set("taken");
        await submit();

        expect(component.step()).toBe(1);
    });

    it("should suggest the country from the phone code", () => {
        component.form.controls.phone.setValue("+221 77 123 45 67");

        expect(component.form.controls.country.value).toBe("Sénégal");
    });

    it("should not leave the shop step without a shop name", async () => {
        await submit();

        expect(component.step()).toBe(1);
        expect(el.textContent).toContain("Le nom de la boutique est obligatoire.");
    });

    it("should show separate first and last name fields on the account step", async () => {
        await goToAccountStep();

        expect(component.step()).toBe(2);
        expect(el.querySelector("#register-firstName")).not.toBeNull();
        expect(el.querySelector("#register-lastName")).not.toBeNull();
        expect(el.textContent).toContain("Chez Fatou");
    });

    it("should go back to the shop step and keep the typed values", async () => {
        await goToAccountStep();

        el.querySelector<HTMLButtonElement>(".text-link")!.click();
        await fixture.whenStable();

        expect(component.step()).toBe(1);
        expect(component.form.controls.shopName.value).toBe("Chez Fatou");
    });

    it("should show errors and not call the API when the account is incomplete", async () => {
        await goToAccountStep();
        await submit();

        expect(auth.register).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Le mot de passe est obligatoire.");
    });

    it("should register with first name, last name and a lowercase email", async () => {
        await goToAccountStep();
        fillAccount();
        await submit();

        expect(auth.register).toHaveBeenCalledWith({
            shopName: "Chez Fatou",
            phone: "+226 70 12 34 56",
            country: "Burkina Faso",
            city: "Ouagadougou",
            firstName: "Fatou",
            lastName: "Ouédraogo",
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

        await goToAccountStep();
        fillAccount();
        await submit();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain(
            "Aucune boutique n'a été créée.",
        );
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("should refuse the account when the two passwords differ", async () => {
        await goToAccountStep();
        fillAccount();
        component.form.patchValue({ confirmPassword: "Autre-mot-2026" });
        await submit();

        expect(auth.register).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Les deux mots de passe ne sont pas identiques.");
    });

    it("should show the password strength while typing", async () => {
        await goToAccountStep();
        component.form.patchValue({ password: "Boutique-2026!" });
        await fixture.whenStable();

        expect(el.querySelector("app-password-strength")?.textContent).toContain("Excellent");
    });

    it("should tick the email only when it looks complete", async () => {
        await goToAccountStep();

        component.form.patchValue({ email: "fatou@exemple" });
        await fixture.whenStable();
        expect(el.querySelector(".valid-mark")).toBeNull();

        component.form.patchValue({ email: "fatou@exemple.com" });
        await fixture.whenStable();
        expect(el.querySelector(".valid-mark")).not.toBeNull();
    });

    it("should show the success state on the button once the shop is created", async () => {
        await goToAccountStep();
        fillAccount();
        await submit();

        const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        expect(button.textContent).toContain("Boutique créée");
        expect(button.disabled).toBe(true);
    });

    it("should light up the logo zone while a file is dragged over it", async () => {
        const zone = el.querySelector(".drop")!;

        zone.dispatchEvent(new Event("dragover", { cancelable: true }));
        await fixture.whenStable();
        expect(zone.classList).toContain("dragging");

        zone.dispatchEvent(new Event("dragleave"));
        await fixture.whenStable();
        expect(zone.classList).not.toContain("dragging");
    });
});

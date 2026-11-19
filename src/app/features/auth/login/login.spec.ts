import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Login } from "./login";
import { AuthService } from "../../../core/auth/auth.service";

describe("Login", () => {
    let fixture: ComponentFixture<Login>;
    let component: Login;
    let el: HTMLElement;
    let auth: {
        login: ReturnType<typeof vi.fn>;
        isOwner: () => boolean;
        user: () => { mustChangePassword?: boolean } | null;
    };
    let router: Router;

    beforeEach(async () => {
        auth = { login: vi.fn(), isOwner: () => false, user: () => null };

        await TestBed.configureTestingModule({
            imports: [Login],
            providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
        }).compileComponents();

        fixture = TestBed.createComponent(Login);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        await fixture.whenStable();
    });

    function fillForm(email = "awa@test.com", password = "secret") {
        component.form.patchValue({ email, password });
    }

    async function submit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should create", () => {
        expect(component).toBeTruthy();
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

        expect(auth.login).toHaveBeenCalledWith("awa@test.com", "secret", true);
        expect(router.navigate).toHaveBeenCalledWith(["/dashboard"]);
    });

    it("should send the owner to the list of shops", async () => {
        auth.login.mockReturnValue(of({}));
        auth.isOwner = () => true;
        fillForm();
        await submit();

        expect(auth.login).toHaveBeenCalledWith("awa@test.com", "secret", true);
        expect(router.navigate).toHaveBeenCalledWith(["/owner"]);
    });

    it("should pass remember = false when the box is unchecked", async () => {
        auth.login.mockReturnValue(of({}));
        fillForm();
        component.form.controls.remember.setValue(false);
        await submit();

        expect(auth.login).toHaveBeenCalledWith("awa@test.com", "secret", false);
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
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { ForgotPassword } from "./forgot-password";
import { AuthService } from "../../../core/auth/auth.service";

describe("ForgotPassword", () => {
    let fixture: ComponentFixture<ForgotPassword>;
    let component: ForgotPassword;
    let el: HTMLElement;
    let auth: { forgotPassword: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        auth = { forgotPassword: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [ForgotPassword],
            providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
        }).compileComponents();

        fixture = TestBed.createComponent(ForgotPassword);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        await fixture.whenStable();
    });

    async function submit(email: string) {
        component.form.patchValue({ email });
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should create with a link back to the login page", () => {
        const link = el.querySelector("a") as HTMLAnchorElement;

        expect(link.getAttribute("href")).toBe("/login");
    });

    it("should refuse an empty email without calling the API", async () => {
        await submit("");

        expect(auth.forgotPassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("L'adresse e-mail est obligatoire.");
    });

    it("should refuse an invalid email without calling the API", async () => {
        await submit("pas-un-email");

        expect(auth.forgotPassword).not.toHaveBeenCalled();
        expect(el.textContent).toContain("L'adresse e-mail n'est pas valide.");
    });

    it("should send the email in lowercase", async () => {
        auth.forgotPassword.mockReturnValue(of({ message: "ok" }));

        await submit("Awa@Test.COM");

        expect(auth.forgotPassword).toHaveBeenCalledWith("awa@test.com");
    });

    it("should show the neutral message after success", async () => {
        auth.forgotPassword.mockReturnValue(of({ message: "ok" }));

        await submit("awa@test.com");

        expect(el.textContent).toContain("Vérifiez votre boîte mail");
        expect(el.querySelector("form")).toBeNull();
    });

    it("should show the API error (429) and keep the form", async () => {
        auth.forgotPassword.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 429,
                        error: { message: "Trop de demandes, réessayez dans une heure." },
                    }),
            ),
        );

        await submit("awa@test.com");

        expect(el.textContent).toContain("Trop de demandes, réessayez dans une heure.");
        expect(el.textContent).not.toContain("Vérifiez votre boîte mail");
    });

    it("should show a network message when the server is unreachable", async () => {
        auth.forgotPassword.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

        await submit("awa@test.com");

        expect(el.textContent).toContain("Impossible de joindre le serveur");
    });
});

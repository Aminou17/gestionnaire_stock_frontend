import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { VerifyEmail } from "./verify-email";

describe("VerifyEmail", () => {
    let auth: { verifyEmail: ReturnType<typeof vi.fn>; resendCode: ReturnType<typeof vi.fn> };
    let el: HTMLElement;
    let router: Router;

    async function render() {
        auth = {
            verifyEmail: vi.fn(() => of({})),
            resendCode: vi.fn(() => of({ message: "ok" })),
        };

        await TestBed.configureTestingModule({
            imports: [VerifyEmail],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: auth },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap({ email: "fatou@exemple.com" }),
                        },
                    },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        const fixture = TestBed.createComponent(VerifyEmail);
        el = fixture.nativeElement;
        await fixture.whenStable();
        return fixture;
    }

    const boxes = () => Array.from(el.querySelectorAll<HTMLInputElement>(".digit"));

    it("montre l'adresse et six cases", async () => {
        await render();
        expect(el.textContent).toContain("fatou@exemple.com");
        expect(boxes().length).toBe(6);
    });

    it("un code collé remplit les cases et part tout seul", async () => {
        const fixture = await render();
        boxes()[0].value = "123456";
        boxes()[0].dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(auth.verifyEmail).toHaveBeenCalledWith("fatou@exemple.com", "123456");
        expect(router.navigate).toHaveBeenCalledWith(["/dashboard"], { state: { welcome: true } });
    });

    it("un code faux affiche le message et vide les cases", async () => {
        const fixture = await render();
        auth.verifyEmail.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 400, error: { message: "Code incorrect." } }),
            ),
        );

        boxes()[0].value = "000000";
        boxes()[0].dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(el.textContent).toContain("Code incorrect.");
        expect(boxes().every((box) => box.value === "")).toBe(true);
    });

    it("le renvoi du code attend une minute", async () => {
        await render();
        expect(el.querySelector(".resend")?.textContent).toContain("Nouveau code dans");
        expect(auth.resendCode).not.toHaveBeenCalled();
    });
});

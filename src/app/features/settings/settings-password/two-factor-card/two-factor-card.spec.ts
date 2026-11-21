import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../../core/auth/auth.service";
import { TwoFactorCard } from "./two-factor-card";

describe("TwoFactorCard", () => {
    let fixture: ComponentFixture<TwoFactorCard>;
    let component: TwoFactorCard;
    let el: HTMLElement;
    let auth: Record<string, ReturnType<typeof vi.fn> | unknown>;

    async function render(twoFactorEnabled = false) {
        auth = {
            user: signal({ twoFactorEnabled }),
            refreshUser: vi.fn(() => of({})),
            setupTwoFactor: vi.fn(() =>
                of({ secret: "ABCDEFGHIJKLMNOP", otpauthUrl: "otpauth://totp/x?secret=ABCD" }),
            ),
            enableTwoFactor: vi.fn(() => of({ backupCodes: ["aaaaa-bbbbb", "ccccc-ddddd"] })),
            disableTwoFactor: vi.fn(() => of({ message: "ok" })),
            setTwoFactorEnabled: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [TwoFactorCard],
            providers: [{ provide: AuthService, useValue: auth }],
        }).compileComponents();

        fixture = TestBed.createComponent(TwoFactorCard);
        component = fixture.componentInstance;
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should offer to activate when it is off", async () => {
        await render(false);

        expect(el.textContent).toContain("Désactivée");
        expect(el.textContent).toContain("Activer la double authentification");
    });

    it("should show the key in groups of 4 after starting the setup", async () => {
        await render(false);

        component.start();
        await fixture.whenStable();

        expect(component.step()).toBe("setup");
        expect(el.querySelector("code")?.textContent).toBe("ABCD EFGH IJKL MNOP");
    });

    it("should show the backup codes once after a good code", async () => {
        await render(false);
        component.start();
        component.codeControl.setValue("123456");

        component.enable();
        await fixture.whenStable();

        expect(auth["enableTwoFactor"]).toHaveBeenCalledWith("123456");
        expect(component.step()).toBe("codes");
        expect(el.textContent).toContain("aaaaa-bbbbb");

        component.finishCodes();
        expect(component.backupCodes()).toEqual([]);
        expect(component.step()).toBe("on");
    });

    it("should not send a code that is not 6 digits", async () => {
        await render(false);
        component.codeControl.setValue("12");

        component.enable();

        expect(auth["enableTwoFactor"]).not.toHaveBeenCalled();
    });

    it("should show the error when the code is wrong", async () => {
        await render(false);
        (auth["enableTwoFactor"] as ReturnType<typeof vi.fn>).mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 400, error: { message: "Code incorrect." } }),
            ),
        );
        component.codeControl.setValue("123456");

        component.enable();
        await fixture.whenStable();

        expect(component.error()).toBe("Code incorrect.");
        expect(component.step()).not.toBe("codes");
    });

    it("should ask for the password and a code to turn it off", async () => {
        await render(true);
        expect(el.textContent).toContain("Activée");

        component.askDisable();
        component.disable();
        expect(auth["disableTwoFactor"]).not.toHaveBeenCalled();

        component.disableForm.setValue({ password: "mdp", code: "123456" });
        component.disable();

        expect(auth["disableTwoFactor"]).toHaveBeenCalledWith("mdp", "123456");
        expect(component.step()).toBe("off");
    });
});

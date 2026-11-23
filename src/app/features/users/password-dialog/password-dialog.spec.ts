import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { PasswordDialog } from "./password-dialog";
import { UserAccount } from "../user.model";
import { UserService } from "../user.service";

const moussa: UserAccount = {
    id: 2,
    name: "Moussa Traoré",
    first_name: "Moussa",
    last_name: "Traoré",
    email: "moussa@test.com",
    role: "manager",
    is_active: true,
    created_at: "2026-01-10T10:00:00Z",
    last_login_at: null,
};

describe("PasswordDialog", () => {
    let fixture: ComponentFixture<PasswordDialog>;
    let el: HTMLElement;
    let resetPassword: ReturnType<typeof vi.fn>;

    async function render({ fails = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        resetPassword = vi.fn(() =>
            fails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Cet employé est supprimé." },
                          }),
                  )
                : of({ message: "ok", user: moussa }),
        );

        await TestBed.configureTestingModule({
            imports: [PasswordDialog],
            providers: [{ provide: UserService, useValue: { resetPassword } }],
        }).compileComponents();

        fixture = TestBed.createComponent(PasswordDialog);
        el = fixture.nativeElement;
        fixture.componentInstance.open(moussa);
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const submit = async () => {
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    };

    it("should refuse a password shorter than 8 characters", async () => {
        await render();
        fixture.componentInstance.form.patchValue({ password: "court" });
        await submit();

        expect(resetPassword).not.toHaveBeenCalled();
        expect(text()).toContain("au moins 8 caractères");
    });

    it("should send the password and show it once to pass it on", async () => {
        await render();
        fixture.componentInstance.form.patchValue({ password: "nouveau-mdp" });
        await submit();

        expect(resetPassword).toHaveBeenCalledWith(2, "nouveau-mdp");
        expect(text()).toContain("Mot de passe changé");
        expect(el.querySelector("code")!.textContent).toBe("nouveau-mdp");
    });

    it("should forget the password when the dialog closes", async () => {
        await render();
        fixture.componentInstance.form.patchValue({ password: "nouveau-mdp" });
        await submit();
        // Échap ferme la fenêtre sans passer par close()
        el.querySelector("dialog")!.dispatchEvent(new Event("close"));
        await fixture.whenStable();

        expect(fixture.componentInstance.savedPassword()).toBeNull();
        expect(el.querySelector("code")).toBeNull();
    });

    it("should show the backend message", async () => {
        await render({ fails: true });
        fixture.componentInstance.form.patchValue({ password: "nouveau-mdp" });
        await submit();

        expect(text()).toContain("Cet employé est supprimé.");
    });
});

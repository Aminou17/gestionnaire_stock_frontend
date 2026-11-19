import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { UserForm } from "./user-form";
import { AuthService } from "../../../core/auth/auth.service";
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

describe("UserForm", () => {
    let fixture: ComponentFixture<UserForm>;
    let el: HTMLElement;
    let createUser: ReturnType<typeof vi.fn>;
    let updateUser: ReturnType<typeof vi.fn>;
    let refreshUser: ReturnType<typeof vi.fn>;

    async function render({ fails = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        const answer = () =>
            fails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Cet email est déjà utilisé." },
                          }),
                  )
                : of({ message: "ok", user: moussa });
        createUser = vi.fn(answer);
        updateUser = vi.fn(answer);
        refreshUser = vi.fn(() => of(null));

        await TestBed.configureTestingModule({
            imports: [UserForm],
            providers: [
                { provide: UserService, useValue: { createUser, updateUser } },
                {
                    provide: AuthService,
                    useValue: { user: signal({ id: 1, role: "admin" }), refreshUser },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(UserForm);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const form = () => fixture.componentInstance.form;
    const submit = async () => {
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    };

    it("should require a name, a valid email and a password of 8 characters", async () => {
        await render();
        fixture.componentInstance.openNew();
        form().patchValue({ email: "pas-un-email", password: "court" });
        await submit();

        expect(createUser).not.toHaveBeenCalled();
        expect(text()).toContain("Le prénom est obligatoire.");
        expect(text()).toContain("Indiquez une adresse e-mail valide.");
        expect(text()).toContain("au moins 8 caractères");
    });

    it("should create a manager with the email in lowercase", async () => {
        await render();
        fixture.componentInstance.openNew();
        form().patchValue({
            firstName: "  Moussa ",
            lastName: " Traoré ",
            email: "Moussa@Test.com",
            password: "motdepasse",
        });
        await submit();

        expect(createUser).toHaveBeenCalledWith({
            firstName: "Moussa",
            lastName: "Traoré",
            email: "moussa@test.com",
            role: "manager",
            password: "motdepasse",
        });
    });

    it("should fill a generated password", async () => {
        await render();
        fixture.componentInstance.openNew();
        fixture.componentInstance.fillPassword();

        expect(form().controls.password.value).toMatch(/^[a-zA-Z2-9]{10}$/);
        expect(fixture.componentInstance.showPassword()).toBe(true);
    });

    it("should update without sending a password", async () => {
        await render();
        fixture.componentInstance.openEdit(moussa);
        form().patchValue({ role: "admin" });
        await submit();

        expect(updateUser).toHaveBeenCalledWith(2, {
            firstName: "Moussa",
            lastName: "Traoré",
            email: "moussa@test.com",
            role: "admin",
        });
        expect(el.querySelector("#user-form-password")).toBeNull();
    });

    it("should lock the role when editing its own account", async () => {
        await render();
        fixture.componentInstance.openEdit({ ...moussa, id: 1, role: "admin" });
        await fixture.whenStable();

        expect(form().controls.role.disabled).toBe(true);
        expect(text()).toContain("Vous ne pouvez pas changer votre propre rôle.");
    });

    it("should show the backend message", async () => {
        await render({ fails: true });
        fixture.componentInstance.openNew();
        form().patchValue({
            firstName: "Moussa",
            email: "moussa@test.com",
            password: "motdepasse",
        });
        await submit();

        expect(text()).toContain("Cet email est déjà utilisé.");
    });
});

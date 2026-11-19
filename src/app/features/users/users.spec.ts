import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Users } from "./users";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { UserAccount } from "./user.model";
import { UserService } from "./user.service";

const me: UserAccount = {
    id: 1,
    name: "Awa Bazin",
    first_name: "Awa",
    last_name: "Bazin",
    email: "awa@test.com",
    role: "admin",
    is_active: true,
    created_at: "2026-01-10T10:00:00Z",
    last_login_at: new Date().toISOString(),
};

const moussa: UserAccount = {
    ...me,
    id: 2,
    name: "Moussa Traoré",
    first_name: "Moussa",
    last_name: "Traoré",
    email: "moussa@test.com",
    role: "manager",
    last_login_at: null,
};

const ancien: UserAccount = { ...moussa, id: 3, name: "Ancien employé", is_active: false };

describe("Users", () => {
    let fixture: ComponentFixture<Users>;
    let el: HTMLElement;
    let deleteUser: ReturnType<typeof vi.fn>;
    let restoreUser: ReturnType<typeof vi.fn>;

    async function render({ deleteFails = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        deleteUser = vi.fn(() =>
            deleteFails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Cet utilisateur est déjà supprimé." },
                          }),
                  )
                : of({ message: "ok", user: { ...moussa, is_active: false } }),
        );
        restoreUser = vi.fn(() => of({ message: "ok", user: { ...ancien, is_active: true } }));

        await TestBed.configureTestingModule({
            imports: [Users],
            providers: [
                provideRouter([]),
                {
                    provide: UserService,
                    useValue: {
                        getUsers: vi.fn(() => of([me, moussa, ancien])),
                        deleteUser,
                        restoreUser,
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: me.name, email: me.email, role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Users);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const rows = () => el.querySelectorAll(".row");
    const click = async (target: Element | null) => {
        (target as HTMLElement).click();
        await fixture.whenStable();
    };
    // les entrées du menu d'une ligne (le panneau reste dans la page, fermé)
    const menuItem = (row: number, label: string) =>
        Array.from(rows()[row].querySelectorAll("app-action-menu .item")).find((item) =>
            item.textContent!.includes(label),
        )!;

    it("should list active users with their role and last login", async () => {
        await render();

        expect(rows().length).toBe(2);
        expect(text()).toContain("Moussa Traoré");
        expect(text()).toContain("Employé");
        expect(text()).toContain("Administrateur");
        expect(text()).toContain("Jamais connecté");
        expect(text()).toContain("Actifs 2");
        expect(text()).toContain("Supprimés 1");
        expect(text()).not.toContain("Ancien employé");
    });

    it("should mark the connected user and hide delete on its own row", async () => {
        await render();

        expect(rows()[0].textContent).toContain("Vous");
        await click(rows()[0].querySelector(".more-btn"));

        expect(menuItem(0, "Mon mot de passe")).toBeTruthy();
        expect(menuItem(0, "Supprimer")).toBeUndefined();
    });

    it("should search by name or email", async () => {
        await render();
        fixture.componentInstance.search.set("moussa@");
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Moussa Traoré");
    });

    it("should open the user page on row click", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        await click(rows()[1]);

        expect(navigate).toHaveBeenCalledWith(["/users", 2]);
    });

    it("should delete a user after confirmation", async () => {
        await render();
        await click(rows()[1].querySelector(".more-btn"));
        await click(menuItem(1, "Supprimer"));

        expect(text()).toContain("Moussa Traoré ne pourra plus se connecter");
        await click(el.querySelector(".confirm .btn-danger"));

        expect(deleteUser).toHaveBeenCalledWith(2);
    });

    it("should show the backend message when delete fails", async () => {
        await render({ deleteFails: true });
        await click(rows()[1].querySelector(".more-btn"));
        await click(menuItem(1, "Supprimer"));
        await click(el.querySelector(".confirm .btn-danger"));

        expect(text()).toContain("Cet utilisateur est déjà supprimé.");
    });

    it("should restore a deleted user", async () => {
        await render();
        await click(el.querySelectorAll(".chip")[1]);

        expect(text()).toContain("Ancien employé");
        await click(el.querySelector(".restore-btn"));

        expect(restoreUser).toHaveBeenCalledWith(3);
    });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { UserPage } from "./user-page";
import { AuthService } from "../../../core/auth/auth.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
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

describe("UserPage", () => {
    let fixture: ComponentFixture<UserPage>;
    let el: HTMLElement;
    let deleteUser: ReturnType<typeof vi.fn>;
    let restoreUser: ReturnType<typeof vi.fn>;

    async function render({
        id = "2",
        user = moussa,
        notFound = false,
        activityFails = false,
    }: { id?: string; user?: UserAccount; notFound?: boolean; activityFails?: boolean } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        deleteUser = vi.fn(() => of({ message: "ok", user: { ...user, is_active: false } }));
        restoreUser = vi.fn(() => of({ message: "ok", user: { ...user, is_active: true } }));

        await TestBed.configureTestingModule({
            imports: [UserPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id })) },
                },
                {
                    provide: UserService,
                    useValue: {
                        getUser: vi.fn(() =>
                            notFound
                                ? throwError(() => new HttpErrorResponse({ status: 404 }))
                                : of(user),
                        ),
                        getActivity: vi.fn(() =>
                            activityFails
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of([
                                      {
                                          id: 11,
                                          action: "AUTH_LOGIN_SUCCEEDED",
                                          entity_type: "user",
                                          entity_id: 2,
                                          result: "SUCCESS",
                                          created_at: "2026-11-10T17:00:00Z",
                                      },
                                      {
                                          id: 10,
                                          action: "AUTH_LOGIN_SUCCEEDED",
                                          entity_type: "user",
                                          entity_id: 2,
                                          result: "SUCCESS",
                                          created_at: "2026-11-10T12:00:00Z",
                                      },
                                      {
                                          id: 9,
                                          action: "SALE_CREATED",
                                          entity_type: "sale",
                                          entity_id: 4,
                                          result: "SUCCESS",
                                          created_at: "2026-11-10T09:00:00Z",
                                      },
                                  ]),
                        ),
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
                        user: signal({ id: 1, name: "Awa", email: "awa@test.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(UserPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const button = (label: string) =>
        Array.from(el.querySelectorAll<HTMLElement>("button, a")).find((b) =>
            b.textContent!.includes(label),
        );

    it("should show the user details and recent activity", async () => {
        await render();

        expect(text()).toContain("Moussa Traoré");
        expect(text()).toContain("Employé");
        expect(text()).toContain("moussa@test.com");
        expect(text()).toContain("Dernière connexion Jamais");
        expect(text()).toContain("Vente enregistrée");
    });

    it("should merge the same actions that follow each other in a day", async () => {
        await render();

        const rows = [...el.querySelectorAll(".activity li")].map((li) => li.textContent ?? "");
        expect(rows).toHaveLength(2);
        expect(rows[0]).toContain("2 fois");
    });

    it("should say when the user does not exist", async () => {
        await render({ notFound: true });

        expect(text()).toContain("Cet utilisateur est introuvable.");
    });

    it("should not call the backend for an invalid id", async () => {
        await render({ id: "abc" });

        expect(TestBed.inject(UserService).getUser).not.toHaveBeenCalled();
        expect(text()).toContain("Cet utilisateur est introuvable.");
    });

    it("should keep the details when the activity fails", async () => {
        await render({ activityFails: true });

        expect(text()).toContain("moussa@test.com");
        expect(text()).toContain("Impossible de charger l'activité.");
    });

    it("should delete then go back to the list", async () => {
        await render();
        // la fiche est quittée sans rester dans l'historique
        const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);

        button("Supprimer")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLElement>(".confirm .btn-danger")!.click();
        await fixture.whenStable();

        expect(deleteUser).toHaveBeenCalledWith(2);
        expect(navigate).toHaveBeenCalledWith("/users", { replaceUrl: true });
    });

    it("should not offer delete or password reset on its own page", async () => {
        await render({ id: "1", user: { ...moussa, id: 1, role: "admin" } });

        expect(text()).toContain("Vous");
        expect(button("Supprimer")).toBeUndefined();
        expect(button("Nouveau mot de passe")).toBeUndefined();
        expect(button("Mon mot de passe")).toBeTruthy();
    });

    it("should restore a deleted user", async () => {
        await render({ user: { ...moussa, is_active: false } });

        expect(text()).toContain("Supprimé");
        button("Restaurer l'accès")!.click();
        await fixture.whenStable();

        expect(restoreUser).toHaveBeenCalledWith(2);
    });
});

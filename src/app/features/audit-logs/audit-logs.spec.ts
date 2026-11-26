import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { Observable, of, throwError } from "rxjs";

import { AuditLogs } from "./audit-logs";
import { AuditLog, AuditLogPage } from "../../core/audit/audit-log.model";
import { AuditLogService } from "../../core/audit/audit-log.service";
import { AuthService } from "../../core/auth/auth.service";
import { UserService } from "../users/user.service";

const sale: AuditLog = {
    id: 2,
    user_id: 2,
    user_name: "Moussa Traoré",
    action: "SALE_CREATED",
    entity_type: "sale",
    entity_id: 12,
    details: null,
    result: "SUCCESS",
    ip_address: "10.0.0.5",
    created_at: "2026-01-10T10:00:00Z",
};

const failedLogin: AuditLog = {
    id: 1,
    user_id: null,
    user_name: null,
    action: "AUTH_LOGIN_FAILED",
    entity_type: "user",
    entity_id: null,
    details: { attemptedEmail: "intrus@test.com" },
    result: "FAILURE",
    ip_address: "203.0.113.9",
    created_at: "2026-01-10T09:00:00Z",
};

describe("AuditLogs", () => {
    let fixture: ComponentFixture<AuditLogs>;
    let el: HTMLElement;
    let getLogs: ReturnType<typeof vi.fn>;

    const onePage: AuditLogPage = {
        data: [sale, failedLogin],
        pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
    };

    async function render(
        answer: (filters: { page: number }) => Observable<AuditLogPage> = () => of(onePage),
        query: Record<string, string> = {},
    ) {
        getLogs = vi.fn(answer);

        await TestBed.configureTestingModule({
            imports: [AuditLogs],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
                },
                { provide: AuditLogService, useValue: { getLogs } },
                { provide: UserService, useValue: { getUsers: vi.fn(() => of([])) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Adam", email: "a@test.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AuditLogs);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should write who did what as a sentence, with a link to the sale", async () => {
        await render();

        expect(text()).toContain("Moussa a encaissé une vente de");
        expect(el.querySelector("a.entry[href='/sales/12']")).not.toBeNull();
        expect(el.querySelector(".entry .kind")).not.toBeNull();
    });

    it("should show the email tried on a failed login", async () => {
        await render();

        expect(text()).toContain("intrus@test.com n'a pas pu se connecter");
        expect(el.querySelector(".failed .pill-danger")).not.toBeNull();
    });

    it("should explain a denied access without showing the route", async () => {
        const denied: AuditLog = {
            ...failedLogin,
            id: 3,
            user_id: 2,
            user_name: "Moussa Traoré",
            action: "ACCESS_DENIED",
            details: { method: "PATCH", path: "/categories/4/restore" },
        };
        await render(() =>
            of({ data: [denied], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } }),
        );

        expect(text()).toContain("Moussa a essayé de restaurer une catégorie");
        expect(text()).toContain("Réservé à l'administrateur");
        expect(text()).not.toContain("/categories");
    });

    it("should show what changed in a sheet when a row is opened", async () => {
        const updated: AuditLog = {
            ...sale,
            id: 4,
            action: "PRODUCT_UPDATED",
            entity_type: "product",
            entity_id: 7,
            details: {
                before: { name: "Bazin riche", sale_price: 12000, updated_at: "a" },
                after: { name: "Bazin riche", sale_price: 15000, updated_at: "b" },
            },
        };
        await render(() =>
            of({ data: [updated], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } }),
        );

        expect(text()).toContain("a modifié le produit Bazin riche");
        expect(el.querySelector(".detail")).toBeNull();

        el.querySelector<HTMLButtonElement>("button.entry")!.click();
        await fixture.whenStable();

        expect(el.querySelectorAll(".changes li").length).toBe(1);
        expect(text()).toContain("Prix de vente");
        expect(el.querySelector(".detail a[href='/products/7']")).not.toBeNull();
    });

    it("should merge logins in a row of the same person", async () => {
        const login = (id: number, time: string): AuditLog => ({
            ...sale,
            id,
            action: "AUTH_LOGIN_SUCCEEDED",
            entity_type: "user",
            entity_id: 2,
            created_at: time,
        });
        await render(
            () =>
                of({
                    data: [login(5, "2026-01-10T10:00:00Z"), login(6, "2026-01-10T09:00:00Z")],
                    pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
                }),
            { result: "FAILURE" },
        );

        expect(el.querySelectorAll(".entry").length).toBe(1);
        expect(text()).toContain("s'est connecté 2 fois");
    });

    it("should split the journal between activity and security", async () => {
        await render();
        expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ category: "activity" }));

        el.querySelectorAll<HTMLButtonElement>(".tab")[1].click();
        await fixture.whenStable();

        expect(getLogs).toHaveBeenCalledWith(
            expect.objectContaining({ category: "security", limit: 25 }),
        );
        // Plus de rangée de compteurs : les filtres de l'onglet sont visibles tout de suite
        expect(el.querySelector(".summary")).toBeNull();
        expect(el.querySelectorAll(".filters select").length).toBe(2);
    });

    it("should ask only for failures when asked", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".tab")[1].click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".filters button.chip")!.click();
        await fixture.whenStable();

        expect(getLogs).toHaveBeenLastCalledWith(
            expect.objectContaining({ result: "FAILURE", page: 1 }),
        );
    });

    it("should filter on a person", async () => {
        await render();
        fixture.componentInstance.selectUser("2");
        await fixture.whenStable();

        expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 2 }));
    });

    it("should start on failures when opened from an alert link", async () => {
        await render(undefined, { result: "FAILURE" });

        expect(getLogs).toHaveBeenCalledWith(
            expect.objectContaining({ result: "FAILURE", category: "security" }),
        );
    });

    it("should show the next page in place of the first one", async () => {
        await render(({ page }) =>
            of({
                data: page === 1 ? [sale] : [failedLogin],
                pagination: { page, limit: 25, total: 30, totalPages: 2 },
            }),
        );
        expect(text()).toContain("1 à 25 sur 30");

        el.querySelector<HTMLButtonElement>("app-pagination .next")!.click();
        await fixture.whenStable();

        expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 25 }));
        expect(el.querySelectorAll(".entry").length).toBe(1);
        expect(text()).toContain("26 à 30 sur 30");
    });

    it("should offer to retry when the first page fails", async () => {
        await render(() => throwError(() => new HttpErrorResponse({ status: 500 })));

        expect(text()).toContain("Impossible de charger le journal.");
        expect(el.querySelector(".entry")).toBeNull();
        expect(el.querySelector(".empty button")).not.toBeNull();
    });

    it("should keep the pagination and show the error when the next page fails", async () => {
        await render(({ page }) =>
            page === 1
                ? of({ data: [sale], pagination: { page, limit: 25, total: 30, totalPages: 2 } })
                : throwError(() => new HttpErrorResponse({ status: 500 })),
        );
        el.querySelector<HTMLButtonElement>("app-pagination .next")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".list-error")).not.toBeNull();
        expect(el.querySelector("app-pagination .prev")).not.toBeNull();
    });

    it("should say when no entry matches the filters", async () => {
        await render(() =>
            of({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
        );
        fixture.componentInstance.selectUser("2");
        await fixture.whenStable();

        expect(text()).toContain("Aucun événement pour ces filtres.");
    });

    it("should show the full name and the address of a row in its detail", async () => {
        await render();
        el.querySelector<HTMLButtonElement>("button.entry")!.click();
        await fixture.whenStable();

        expect(text()).toContain("203.0.113.9");
        expect(text()).toContain("intrus@test.com");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await fixture.whenStable();
        expect(el.querySelector(".detail")).toBeNull();
    });

    it("should search after a short pause", async () => {
        await render();
        const input = el.querySelector<HTMLInputElement>(".search input")!;
        input.value = "bazin";
        input.dispatchEvent(new Event("input"));
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fixture.whenStable();

        expect(getLogs).toHaveBeenLastCalledWith(
            expect.objectContaining({ search: "bazin", page: 1 }),
        );
    });

    it("should keep the filters visible, with no panel to open", async () => {
        await render();

        expect(el.querySelector(".filter-btn")).toBeNull();
        expect(el.querySelectorAll(".filters select").length).toBe(2);
        expect(el.querySelectorAll(".periods .period").length).toBe(4);
    });
});

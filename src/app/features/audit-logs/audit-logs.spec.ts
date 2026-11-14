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
                        user: signal({ id: 1, name: "Awa", email: "a@test.com", role: "admin" }),
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

        expect(text()).toContain("Moussa Traoré a encaissé une vente de");
        expect(el.querySelector(".entry .avatar img")).not.toBeNull();
        expect(el.querySelector("a[href='/sales/12']")).not.toBeNull();
        expect(text()).toContain("IP 10.0.0.5");
    });

    it("should show the email tried on a failed login", async () => {
        await render();

        expect(text()).toContain("intrus@test.com n'a pas pu se connecter");
        expect(el.querySelector(".failed .avatar app-icon")).not.toBeNull();
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

        expect(text()).toContain("Moussa Traoré a essayé de restaurer une catégorie");
        expect(text()).toContain("Réservé à l'administrateur");
        expect(text()).not.toContain("/categories");
    });

    it("should show what changed when a row is opened", async () => {
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
        expect(el.querySelectorAll(".changes dt").length).toBe(1);
        expect(text()).toContain("Prix de vente");
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
        expect(getLogs).toHaveBeenCalledWith(
            expect.objectContaining({ action: "ACCESS_DENIED", result: "FAILURE", limit: 1 }),
        );
        expect(el.querySelector(".summary")!.textContent).toContain("2");
    });

    it("should ask only for failures when asked", async () => {
        await render();
        el.querySelector<HTMLButtonElement>("button.chip")!.click();
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

    it("should add the next page without duplicates", async () => {
        await render(({ page }) =>
            of({
                data: page === 1 ? [sale] : [sale, failedLogin],
                pagination: { page, limit: 25, total: 2, totalPages: 2 },
            }),
        );
        el.querySelector<HTMLButtonElement>(".more .btn")!.click();
        await fixture.whenStable();

        expect(el.querySelectorAll(".entry").length).toBe(2);
    });

    it("should offer to retry when the first page fails", async () => {
        await render(() => throwError(() => new HttpErrorResponse({ status: 500 })));

        expect(text()).toContain("Impossible de charger le journal.");
        expect(el.querySelector(".entry")).toBeNull();
        expect(el.querySelector(".empty button")).not.toBeNull();
    });

    it("should not skip a page when the next one fails", async () => {
        await render(({ page }) =>
            page === 1
                ? of({ data: [sale], pagination: { page, limit: 25, total: 2, totalPages: 2 } })
                : throwError(() => new HttpErrorResponse({ status: 500 })),
        );
        el.querySelector<HTMLButtonElement>(".more .btn")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".entry")).not.toBeNull();
        expect(el.querySelector(".list-error")).not.toBeNull();
        expect(el.querySelector(".more .btn")).toBeNull();
    });

    it("should say when no entry matches the filters", async () => {
        await render(() =>
            of({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
        );
        fixture.componentInstance.selectUser("2");
        await fixture.whenStable();

        expect(text()).toContain("Rien ne correspond à ces filtres.");
    });
});

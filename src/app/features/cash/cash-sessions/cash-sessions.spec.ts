import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { CashSessions } from "./cash-sessions";
import { AuthService } from "../../../core/auth/auth.service";
import { CashSession } from "../../../core/cash/cash.model";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

const session = (id: number, overrides: Partial<CashSession> = {}): CashSession => ({
    id,
    session_date: "2026-11-10",
    status: "CLOSED",
    opening_amount: 5000,
    theoretical_amount: 12000,
    actual_amount: 11500,
    difference: -500,
    opened_at: "2026-11-10T08:00:00",
    closed_at: "2026-11-10T19:00:00",
    opened_by: 1,
    opened_by_name: "Yabre M.",
    closed_by_name: "Awa K.",
    closing_note: null,
    explanation_pending: false,
    closed_by: null,
    ...overrides,
});

describe("CashSessions", () => {
    let fixture: ComponentFixture<CashSessions>;
    let el: HTMLElement;

    async function render(getSessions: () => unknown) {
        globalThis.IntersectionObserver = class {
            observe() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;

        await TestBed.configureTestingModule({
            imports: [CashSessions],
            providers: [
                provideRouter([]),
                { provide: CashSessionService, useValue: { getSessions } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Administrateur"),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CashSessions);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, "");

    it("should list the sessions with their gap and status", async () => {
        const open = session(5, {
            status: "OPEN",
            theoretical_amount: null,
            actual_amount: null,
            difference: null,
        });
        await render(() =>
            of({
                data: [open, session(4)],
                pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
            }),
        );

        expect(el.querySelectorAll(".session-card").length).toBe(2);
        expect(el.querySelector("table")).toBeNull();
        expect(text()).toContain("Àclôturer");
        expect(text()).toContain("Écartde−500F");
        // pas de montant inventé pour une caisse encore ouverte
        expect(el.querySelectorAll(".session-card")[0].querySelector(".session-amount")).toBeNull();
    });

    it("should link each session to its detail page", async () => {
        await render(() =>
            of({ data: [session(4)], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
        );

        const link = el.querySelector<HTMLAnchorElement>(".session-card a")!;
        expect(link.getAttribute("href")).toBe("/cash/sessions/4");
    });

    it("should say so when no cash register was ever opened", async () => {
        await render(() =>
            of({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
        );

        expect(text()).toContain("Aucunecaissen'aencoreétéouverte");
    });

    it("should show an error with a retry button", async () => {
        await render(() => throwError(() => new Error("fail")));

        expect(text()).toContain("Impossibledechargerl'historique.");
        expect(text()).toContain("Réessayer");
    });
});

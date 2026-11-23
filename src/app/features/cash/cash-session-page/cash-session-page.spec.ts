import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { CashSessionPage } from "./cash-session-page";
import { AuthService } from "../../../core/auth/auth.service";
import { CashSessionDetail } from "../../../core/cash/cash.model";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

const closed: CashSessionDetail = {
    id: 4,
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
    closed_by: null,
    movements: [
        {
            id: 1,
            type: "SALE",
            amount: 7000,
            user_id: 2,
            user_name: "Awa K.",
            reference_type: "sale",
            reference_id: 8,
            sale_number: 108,
            reason: null,
            reason_category: null,
            created_at: "2026-11-10T09:00:00",
        },
    ],
};

describe("CashSessionPage", () => {
    let fixture: ComponentFixture<CashSessionPage>;
    let el: HTMLElement;

    async function render(getSession: () => unknown) {
        await TestBed.configureTestingModule({
            imports: [CashSessionPage],
            providers: [
                provideRouter([{ path: "cash", children: [] }]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "4" })) },
                },
                { provide: CashSessionService, useValue: { getSession } },
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

        fixture = TestBed.createComponent(CashSessionPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, "");

    it("should show the gap, the amounts and the movements of a closed session", async () => {
        await render(() => of(closed));

        expect(text()).toMatch(/10(novembre|November)2026/);
        expect(text()).toContain("Comptée");
        expect(text()).toContain("−500F");
        expect(text()).toContain("Montantattendu12000F");
        expect(text()).toContain("Montantcompté11500F");
        expect(text()).toContain("ComptageHeure19:00ParAwaK.");
        expect(text()).toContain("Vente#108");
    });

    it("should offer a closing ticket only for a closed session", async () => {
        await render(() => of(closed));

        const ticket = el.querySelector(".ticket");

        expect(text()).toContain("Ticket");
        expect(ticket?.textContent?.replace(/\s+/g, "")).toContain("Compté11500F");
        expect(ticket?.textContent?.replace(/\s+/g, "")).toContain("Écart");
    });

    it("should not offer a closing ticket while the session is open", async () => {
        await render(() => of({ ...closed, status: "OPEN", closed_at: null, opened_by: 2 }));

        expect(el.querySelector(".ticket")).toBeNull();
    });

    it("should not show a gap for a session that is still open", async () => {
        await render(() =>
            of({
                ...closed,
                status: "OPEN",
                opened_by: 2,
                theoretical_amount: null,
                actual_amount: null,
                difference: null,
                closed_at: null,
                closed_by_name: null,
                closing_note: null,
                closed_by: null,
            }),
        );

        expect(text()).toContain("Encours");
        expect(text()).not.toContain("Montantattendu");
        expect(text()).not.toContain("ComptageHeure");
    });

    it("should offer to count a session that was never counted", async () => {
        await render(() =>
            of({
                ...closed,
                status: "UNCOUNTED",
                opened_by: 2,
                actual_amount: null,
                difference: null,
                closed_at: null,
                closed_by_name: null,
            }),
        );

        expect(text()).toContain("Noncomptée");
        expect(text()).toContain("Montantattendu12000F");
        expect(text()).not.toContain("Montantcompté");
        expect(text()).toContain("Compterlacaisse");
        expect(el.querySelector(".ticket")).toBeNull();
    });

    it("should let the owner correct a counting", async () => {
        await render(() => of(closed));

        expect(text()).toContain("Rectifierlecomptage");
    });

    it("should send you back to the cash page for your own open session", async () => {
        await render(() => of({ ...closed, status: "OPEN", closed_at: null }));
        await fixture.whenStable();

        expect(TestBed.inject(Router).url).toBe("/cash");
    });

    it("should list the movements with the newest first", async () => {
        const older = { ...closed.movements[0], id: 1, sale_number: 100 };
        const newer = { ...closed.movements[0], id: 2, sale_number: 200 };
        await render(() => of({ ...closed, movements: [older, newer] }));

        expect(text().indexOf("Vente#200")).toBeLessThan(text().indexOf("Vente#100"));
    });

    it("should say the session is not found on a 404", async () => {
        await render(() =>
            throwError(() => new HttpErrorResponse({ status: 404, statusText: "Not Found" })),
        );

        expect(text()).toContain("Cettecaisseestintrouvable.");
        expect(text()).toContain("Retouràl'historique");
    });

    it("should offer to retry on another error", async () => {
        await render(() =>
            throwError(() => new HttpErrorResponse({ status: 500, statusText: "Server Error" })),
        );

        expect(text()).toContain("Impossibledechargercettecaisse.");
        expect(text()).toContain("Réessayer");
    });
});

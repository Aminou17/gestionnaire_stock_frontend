import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { CashMovements } from "./cash-movements";
import { AuthService } from "../../../core/auth/auth.service";
import { CashMovementFilters, CashMovementRow } from "../../../core/cash/cash.model";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

const row = (id: number, overrides: Partial<CashMovementRow> = {}): CashMovementRow => ({
    id,
    type: "EXPENSE",
    amount: 2500,
    user_id: 1,
    user_name: "Yabre M.",
    reference_type: "manual",
    reference_id: null,
    reason: "Achat de fil",
    reason_category: null,
    session_id: 4,
    created_at: "2026-11-10T09:00:00",
    ...overrides,
});

describe("CashMovements", () => {
    let fixture: ComponentFixture<CashMovements>;
    let el: HTMLElement;
    let getMovements: ReturnType<typeof vi.fn>;

    async function render(stream?: () => unknown) {
        getMovements = vi.fn(
            stream ??
                ((_filters: CashMovementFilters) =>
                    of({
                        data: [row(2), row(1, { type: "DEPOSIT", reason: null })],
                        summary: { totalIn: 10000, totalOut: 2500 },
                        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
                    })),
        );
        globalThis.IntersectionObserver = class {
            observe() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;

        await TestBed.configureTestingModule({
            imports: [CashMovements],
            providers: [
                provideRouter([]),
                { provide: CashMovementService, useValue: { getMovements } },
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

        fixture = TestBed.createComponent(CashMovements);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, "");

    it("should show the totals of the filter and the movements with their reason", async () => {
        await render();

        expect(text()).toContain("10000F");
        expect(text()).toContain("2500F");
        expect(text()).toContain("2mouvements");
        expect(text()).toContain("Achatdefil");
    });

    it("should reload from the first page when a type is chosen", async () => {
        await render();

        [...el.querySelectorAll<HTMLButtonElement>(".chip")]
            .find((chip) => chip.textContent!.trim() === "Dépenses")!
            .click();
        await fixture.whenStable();

        expect(getMovements).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "EXPENSE", page: 1 }),
        );
    });

    it("should say so when nothing matches", async () => {
        await render(() =>
            of({
                data: [],
                summary: { totalIn: 0, totalOut: 0 },
                pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            }),
        );

        expect(text()).toContain("Aucunmouvementpourcesfiltres.");
    });

    it("should show an error with a retry button instead of fake totals", async () => {
        await render(() => throwError(() => new Error("fail")));

        expect(text()).toContain("Impossibledechargerlesmouvements.");
        expect(text()).toContain("Réessayer");
        expect(text()).not.toContain("0F");
    });
});

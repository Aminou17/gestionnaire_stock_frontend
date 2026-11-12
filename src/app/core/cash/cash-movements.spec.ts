import { CashMovement } from "./cash.model";
import { getMovementLabel, isIncome, summarizeMovements } from "./cash-movements";

const movement = (overrides: Partial<CashMovement>): CashMovement => ({
    id: 1,
    type: "SALE",
    amount: 1000,
    user_id: 1,
    user_name: "Awa K.",
    reference_type: null,
    reference_id: null,
    reason: null,
    reason_category: null,
    created_at: "2026-11-10T09:00:00",
    ...overrides,
});

describe("cash movements", () => {
    it("should label sales, refunds and manual movements", () => {
        expect(getMovementLabel(movement({ reference_type: "sale", reference_id: 12 }))).toBe(
            "Vente #12",
        );
        expect(
            getMovementLabel(
                movement({
                    type: "WITHDRAWAL",
                    reference_type: "SALE_CANCELLATION",
                    reference_id: 12,
                }),
            ),
        ).toBe("Remboursement de la vente #12");
        expect(getMovementLabel(movement({ type: "DEPOSIT" }))).toBe("Ajout d'argent");
        expect(getMovementLabel(movement({ type: "EXPENSE" }))).toBe("Dépense");
        expect(getMovementLabel(movement({ type: "WITHDRAWAL" }))).toBe("Retrait");
    });

    it("should count sales and deposits as money coming in", () => {
        expect(isIncome(movement({ type: "SALE" }))).toBe(true);
        expect(isIncome(movement({ type: "DEPOSIT" }))).toBe(true);
        expect(isIncome(movement({ type: "EXPENSE" }))).toBe(false);
        expect(isIncome(movement({ type: "WITHDRAWAL" }))).toBe(false);
    });

    it("should keep refunds apart from the other withdrawals", () => {
        const summary = summarizeMovements([
            movement({ id: 1, type: "SALE", amount: 5000 }),
            movement({ id: 2, type: "DEPOSIT", amount: 2000 }),
            movement({ id: 3, type: "EXPENSE", amount: 500 }),
            movement({ id: 4, type: "WITHDRAWAL", amount: 1000 }),
            movement({
                id: 5,
                type: "WITHDRAWAL",
                amount: 3000,
                reference_type: "SALE_CANCELLATION",
            }),
        ]);

        expect(summary).toEqual({
            sales: 5000,
            deposits: 2000,
            expenses: 500,
            withdrawals: 1000,
            refunds: 3000,
        });
    });
});

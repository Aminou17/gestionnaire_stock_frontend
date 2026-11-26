import { CashMovement } from "./cash.model";
import { getReasonLabel } from "./cash-reasons";

export const isRefund = (movement: CashMovement) =>
    ["SALE_CANCELLATION", "SALE_RETURN"].includes(movement.reference_type ?? "");

// Les ventes et les dépôts entrent dans le tiroir, le reste en sort
export const isIncome = (movement: CashMovement) =>
    movement.type === "SALE" || movement.type === "DEPOSIT";

// L'argent d'une dépense annulée revient dans le tiroir
export const isExpenseCancellation = (movement: CashMovement) =>
    movement.reference_type === "EXPENSE_CANCELLATION";

export const getMovementLabel = (movement: CashMovement) => {
    if (isExpenseCancellation(movement)) return "Dépense annulée";
    if (movement.type === "SALE") return `Vente #${movement.sale_number}`;
    if (isRefund(movement)) return `Remboursement de la vente #${movement.sale_number}`;
    const base =
        movement.type === "DEPOSIT"
            ? "Ajout d'argent"
            : movement.type === "EXPENSE"
              ? "Dépense"
              : "Retrait";
    const reason = getReasonLabel(movement.type, movement.reason_category);
    // Le motif Autre n'apprend rien : la précision écrite suffit
    return reason && movement.reason_category !== "OTHER" ? `${base} · ${reason}` : base;
};

// Détail de ce qui a fait bouger la caisse depuis le fond de caisse
export const summarizeMovements = (movements: CashMovement[]) => {
    const total = (keep: (movement: CashMovement) => boolean) =>
        movements.filter(keep).reduce((sum, movement) => sum + movement.amount, 0);

    return {
        sales: total((m) => m.type === "SALE"),
        deposits: total((m) => m.type === "DEPOSIT" && !isExpenseCancellation(m)),
        refunds: total(isRefund),
        // Une dépense annulée ne compte plus
        expenses: total((m) => m.type === "EXPENSE") - total(isExpenseCancellation),
        withdrawals: total((m) => m.type === "WITHDRAWAL" && !isRefund(m)),
    };
};

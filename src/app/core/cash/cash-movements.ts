import { CashMovement } from "./cash.model";
import { getReasonLabel } from "./cash-reasons";

export const isRefund = (movement: CashMovement) =>
    ["SALE_CANCELLATION", "SALE_RETURN"].includes(movement.reference_type ?? "");

// les ventes et les dépôts entrent dans le tiroir, le reste en sort
export const isIncome = (movement: CashMovement) =>
    movement.type === "SALE" || movement.type === "DEPOSIT";

export const getMovementLabel = (movement: CashMovement) => {
    if (movement.type === "SALE") return `Vente n° ${movement.reference_id}`;
    if (isRefund(movement)) return `Remboursement de la vente n° ${movement.reference_id}`;
    const base =
        movement.type === "DEPOSIT"
            ? "Ajout d'argent"
            : movement.type === "EXPENSE"
              ? "Dépense"
              : "Retrait";
    const reason = getReasonLabel(movement.type, movement.reason_category);
    // le motif Autre n'apprend rien : la précision écrite suffit
    return reason && movement.reason_category !== "OTHER" ? `${base} · ${reason}` : base;
};

// détail de ce qui a fait bouger la caisse depuis le fond de caisse
export const summarizeMovements = (movements: CashMovement[]) => {
    const total = (keep: (movement: CashMovement) => boolean) =>
        movements.filter(keep).reduce((sum, movement) => sum + movement.amount, 0);

    return {
        sales: total((m) => m.type === "SALE"),
        deposits: total((m) => m.type === "DEPOSIT"),
        refunds: total(isRefund),
        expenses: total((m) => m.type === "EXPENSE"),
        withdrawals: total((m) => m.type === "WITHDRAWAL" && !isRefund(m)),
    };
};

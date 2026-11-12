export interface CashSummary {
    id: number;
    status: "OPEN" | "CLOSED";
    // null pour le gérant quand la clôture est à l'aveugle
    openingAmount: number | null;
    balance: number | null;
    openedAt: string;
    openedByName: string | null;
    closedAt: string | null;
}

export interface DashboardSummary {
    cash: CashSummary | null;
    previousOpenSession: {
        id: number;
        sessionDate: string;
        openedAt: string;
        balance: number | null;
    } | null;
    // écart découvert après une clôture à l'aveugle, pas encore expliqué
    pendingExplanation: {
        id: number;
        sessionDate: string;
        difference: number;
        closedBy: number;
    } | null;
    blindClose: boolean;
    // null pour le manager
    stockValue: number | null;
    activeProducts: number | null;
    lowStockCount: number | null;
}

export interface DailySales {
    date: string;
    salesTotal: number;
    salesCount: number;
    cancellationsTotal: number;
    cancellationsCount: number;
    netTotal: number;
}

export interface SalesComparison {
    todayTotal: number;
    // hier, jusqu'à la même heure qu'à l'instant
    yesterdayUntilNowTotal: number;
}

export type ActivityType =
    "SALE" | "REFUND" | "STOCK_ENTRY" | "INVENTORY_ADJUSTMENT" | "CASH_OPENING";

export interface Activity {
    type: ActivityType;
    referenceId: number;
    occurredAt: string;
    amount: number | null;
    quantity: number | null;
    userName: string | null;
    productName: string | null;
    itemsCount: number | null;
}

import { CashSummary, UncountedSession } from "../../core/cash/cash.model";

export interface DashboardSummary {
    cash: CashSummary | null;
    uncountedSession: UncountedSession | null;
    // fond de la caisse du jour tant qu'elle n'existe pas ; null pour le gérant à l'aveugle
    expectedOpening: number | null;
    blindClose: boolean;
    // null pour le manager
    stockValue: number | null;
    activeProducts: number | null;
    lowStockCount: number | null;
    // bénéfice du jour et marge en %, admin seulement ; la marge est null sans vente
    todayProfit?: number | null;
    todayMargin?: number | null;
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
    // numéro de la vente dans la boutique, null hors vente
    saleNumber: number | null;
    occurredAt: string;
    amount: number | null;
    quantity: number | null;
    userName: string | null;
    productName: string | null;
    itemsCount: number | null;
}

import { StockMovement } from "../stock/stock-movement.model";

export type SaleStatus = "ACTIVE" | "CANCELLED";

// seules les espèces passent par le tiroir-caisse
export type PaymentMethod = "CASH" | "MOBILE_MONEY";

export interface NewSalePayment {
    paymentMethod: PaymentMethod;
    // espèces seulement, pour calculer la monnaie rendue
    amountReceived?: number;
    // mobile money seulement, le numéro de la transaction
    paymentReference?: string;
}

export interface Sale {
    id: number;
    user_id: number;
    user_name: string | null;
    user_role: "admin" | "manager" | null;
    total: number;
    status: SaleStatus;
    items_count: number;
    created_at: string;
    cancelled_at: string | null;
}

export interface SaleItem {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    reference_price: number;
    // réduction accordée sur chaque unité
    discount_amount: number;
}

export interface SaleDetail extends Omit<Sale, "items_count"> {
    payment_method: PaymentMethod;
    amount_received: number | null;
    payment_reference: string | null;
    cancellation_reason: string | null;
    cancelled_by_name: string | null;
    items: SaleItem[];
    // la vente puis son remboursement éventuel, avec le stock après chacun
    movements: StockMovement[];
    // ventes voisines, null s'il n'y en a pas (le manager ne voit que les siennes)
    previous_id: number | null;
    next_id: number | null;
}

// compteurs de la période choisie, quel que soit le statut filtré
export interface SaleCounters {
    all: number;
    active: number;
    cancelled: number;
    active_total: number;
}

export interface SalePage {
    data: Sale[];
    total: number;
    counters: SaleCounters;
}

export interface SaleFilters {
    status: SaleStatus | null;
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    page: number;
    limit: number;
}

// unitPrice seulement pour un produit négociable
export interface NewSaleItem {
    productId: number;
    quantity: number;
    unitPrice?: number;
}

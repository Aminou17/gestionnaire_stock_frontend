// ENTRY : entrée de stock, SALE : vente, ADJUSTMENT : remise en stock après un remboursement
export type StockMovementType = "ENTRY" | "SALE" | "ADJUSTMENT";

// affichage commun à la page Mouvements et à la fiche produit
export const MOVEMENT_TYPES = {
    ENTRY: { label: "Entrée", sign: "+", tone: "primary" },
    SALE: { label: "Vente", sign: "−", tone: "success" },
    ADJUSTMENT: { label: "Remboursement", sign: "+", tone: "danger" },
} as const;

export interface StockMovement {
    id: number;
    product_id: number;
    product_name: string;
    type: StockMovementType;
    // toujours positive, c'est le type qui dit si le stock monte ou descend
    quantity: number;
    // absents pour le gérant
    user_id?: number;
    user_name?: string | null;
    reference_type: string | null;
    // null pour le gérant quand la vente est celle d'un autre vendeur
    reference_id: number | null;
    // stock du produit juste après ce mouvement
    stock_after: number;
    created_at: string;
}

// totaux de la période et du produit choisis, tous types confondus
export interface StockMovementCounters {
    movements: number;
    entries: number;
    entry_units: number;
    sales: number;
    sale_units: number;
    adjustments: number;
    adjustment_units: number;
}

export interface StockMovementPage {
    data: StockMovement[];
    total: number;
    counters: StockMovementCounters;
}

export interface StockMovementFilters {
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    type: StockMovementType | null;
    productId: number | null;
    page: number;
    limit: number;
}

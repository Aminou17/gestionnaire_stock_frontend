// ENTRY : entrée de stock, SALE : vente, ADJUSTMENT : retour en stock après un remboursement ou un article rendu
// INVENTORY_GAIN et INVENTORY_LOSS : écart d'un inventaire appliqué au stock
// MANUAL_GAIN et MANUAL_LOSS : ajustement saisi à la main (casse, perte, produit retrouvé)
export type StockMovementType =
    | "ENTRY"
    | "SALE"
    | "ADJUSTMENT"
    | "INVENTORY_GAIN"
    | "INVENTORY_LOSS"
    | "MANUAL_GAIN"
    | "MANUAL_LOSS";

// valeurs acceptées pour filtrer ; INVENTORY et MANUAL regroupent les gains et les pertes,
// IN et OUT regroupent tout ce qui fait monter ou baisser le stock
export type StockMovementFilter = StockMovementType | "INVENTORY" | "MANUAL" | "IN" | "OUT";

export const isInventoryMovement = (movement: { type: StockMovementType }) =>
    movement.type === "INVENTORY_GAIN" || movement.type === "INVENTORY_LOSS";

export const isManualMovement = (movement: { type: StockMovementType }) =>
    movement.type === "MANUAL_GAIN" || movement.type === "MANUAL_LOSS";

// une entrée, un inventaire ou un ajustement ne mènent à aucune vente : seule la vente a une fiche
export const saleId = (movement: StockMovement) =>
    movement.type === "ENTRY" || isInventoryMovement(movement) || isManualMovement(movement)
        ? null
        : movement.reference_id;

// le stock baisse pour une vente, une perte d'inventaire et une perte saisie à la main
export const isOutgoingMovement = (movement: { type: StockMovementType }) =>
    movement.type === "SALE" ||
    movement.type === "INVENTORY_LOSS" ||
    movement.type === "MANUAL_LOSS";

export type AdjustmentDirection = "gain" | "loss";

// motifs proposés dans la fenêtre d'ajustement, par sens ; la clé est celle du backend
export const ADJUSTMENT_REASONS: Record<AdjustmentDirection, { value: string; label: string }[]> = {
    loss: [
        { value: "breakage", label: "Endommagé" },
        { value: "expired", label: "Produit périmé" },
        { value: "theft", label: "Vol" },
        { value: "lost", label: "Perte" },
        { value: "correction", label: "Erreur de saisie" },
        { value: "other", label: "Autre" },
    ],
    gain: [
        { value: "found", label: "Produit retrouvé" },
        { value: "correction", label: "Erreur de saisie" },
        { value: "other", label: "Autre" },
    ],
};

// motif d'un ajustement manuel, pour l'afficher à la place d'une référence
export const adjustmentReasonLabel = (movement: StockMovement) =>
    ADJUSTMENT_REASONS[movement.type === "MANUAL_GAIN" ? "gain" : "loss"].find(
        (reason) => reason.value === movement.reference_type,
    )?.label ?? "Ajustement";

export interface StockAdjustmentInput {
    productId: number;
    direction: AdjustmentDirection;
    quantity: number;
    reason: string;
    note?: string;
}

// affichage commun à la page Mouvements et à la fiche produit
export const MOVEMENT_TYPES = {
    ENTRY: { label: "Entrée", sign: "+", tone: "primary" },
    SALE: { label: "Vente", sign: "−", tone: "success" },
    ADJUSTMENT: { label: "Retour", sign: "+", tone: "danger" },
    INVENTORY_GAIN: { label: "Inventaire", sign: "+", tone: "warning" },
    INVENTORY_LOSS: { label: "Inventaire", sign: "−", tone: "warning" },
    MANUAL_GAIN: { label: "Ajustement", sign: "+", tone: "violet" },
    MANUAL_LOSS: { label: "Ajustement", sign: "−", tone: "violet" },
} as const;

export interface StockMovement {
    id: number;
    product_id: number;
    product_name: string;
    // miniature en data URL, null sans photo
    image?: string | null;
    type: StockMovementType;
    // toujours positive, c'est le type qui dit si le stock monte ou descend
    quantity: number;
    // absents pour l'employé
    user_id?: number;
    user_name?: string | null;
    reference_type: string | null;
    // null pour l'employé quand la vente est celle d'un autre vendeur
    reference_id: number | null;
    // numéro de la vente dans la boutique, masqué comme reference_id
    sale_number?: number | null;
    // stock du produit juste après ce mouvement
    stock_after: number;
    created_at: string;
}

// totaux de la période et du produit choisis, tous types confondus
export interface StockMovementCounters {
    movements: number;
    // mouvements qui font monter le stock, et ceux qui le font baisser
    incoming: number;
    outgoing: number;
    entries: number;
    entry_units: number;
    sales: number;
    sale_units: number;
    adjustments: number;
    adjustment_units: number;
    inventory_adjustments: number;
    inventory_units: number;
    manual_adjustments: number;
    manual_units: number;
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
    type: StockMovementFilter | null;
    productId: number | null;
    page: number;
    limit: number;
}

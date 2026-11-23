export type CashMovementType = "SALE" | "DEPOSIT" | "EXPENSE" | "WITHDRAWAL";

// seuls ces trois types peuvent être saisis à la main
export type ManualMovementType = Exclude<CashMovementType, "SALE">;

export interface CashMovement {
    id: number;
    type: CashMovementType;
    amount: number;
    user_id: number;
    user_name: string | null;
    // "sale" pour une vente, "SALE_CANCELLATION" pour un remboursement, autre valeur pour une saisie manuelle
    reference_type: string | null;
    reference_id: number | null;
    // numéro de la vente dans la boutique pour une vente ou un remboursement
    sale_number?: number | null;
    // motif choisi dans la liste (voir cash-reasons.ts), null pour une vente ou un remboursement
    reason_category: string | null;
    // précision écrite, obligatoire seulement pour le motif Autre
    reason: string | null;
    created_at: string;
}

// OPEN : en cours ; CLOSED : comptée ; UNCOUNTED : d'un jour passé, jamais comptée
export type CashStatus = "OPEN" | "CLOSED" | "UNCOUNTED";

export interface CashSummary {
    id: number;
    status: CashStatus;
    // null pour le gérant tant que la caisse n'est pas comptée (clôture à l'aveugle)
    openingAmount: number | null;
    balance: number | null;
    openedAt: string;
    openedByName: string | null;
    closedAt: string | null;
    // renseignés une fois la caisse comptée
    actualAmount: number | null;
    difference: number | null;
}

// caisse d'un jour passé jamais comptée : elle ne bloque rien, on la rappelle
export interface UncountedSession {
    id: number;
    sessionDate: string;
    openedAt: string;
    openedBy: number;
    openedByName: string | null;
    // montant attendu ; null pour le gérant à l'aveugle
    balance: number | null;
    // nombre de caisses non comptées
    count: number;
}

export interface CashSession {
    id: number;
    // YYYY-MM-DD
    session_date: string;
    status: CashStatus;
    // null pour le gérant tant que la caisse n'est pas comptée (clôture à l'aveugle)
    opening_amount: number | null;
    // solde attendu : vide pour le gérant à l'aveugle, et tant que la caisse est ouverte
    theoretical_amount: number | null;
    actual_amount: number | null;
    difference: number | null;
    opened_at: string;
    closed_at: string | null;
    opened_by: number;
    opened_by_name: string | null;
    closed_by_name: string | null;
    // raison facultative donnée au comptage
    closing_note: string | null;
    closed_by: number | null;
    // présent quand le serveur a masqué les montants (clôture à l'aveugle)
    blind?: boolean;
}

export interface CashSessionDetail extends CashSession {
    // ventes payées en Mobile Money : elles ne passent pas par le tiroir
    mobile_money_total?: number;
    movements: CashMovement[];
}

export interface CashSessionPage {
    data: CashSession[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

// partie caisse de /dashboard/summary
export interface CashToday {
    cash: CashSummary | null;
    uncountedSession: UncountedSession | null;
    expectedOpening: number | null;
    blindClose: boolean;
}

export interface CashMovementRow extends CashMovement {
    session_id: number | null;
    // dépense : un reçu en photo est joint, ou elle a été annulée
    has_receipt?: boolean;
    cancelled?: boolean;
}

export interface CashMovementFilters {
    type: CashMovementType | null;
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    category: string | null;
    // mot cherché dans la description ou chez la personne
    search?: string | null;
    page: number;
    limit: number;
}

export interface CashMovementPage {
    data: CashMovementRow[];
    summary: { totalIn: number; totalOut: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

// GET /cash_movements/expenses/summary
export interface ExpenseSummary {
    total: number;
    count: number;
    categories: { category: string; count: number; total: number }[];
}

// GET /cash_movements/:id
export interface CashMovementDetail extends CashMovementRow {
    user_name: string | null;
    // photo du reçu (image en base64), seulement sur la fiche
    receipt: string | null;
}

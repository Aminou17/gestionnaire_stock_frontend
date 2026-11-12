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
    // motif choisi dans la liste (voir cash-reasons.ts), null pour une vente ou un remboursement
    reason_category: string | null;
    // précision écrite, obligatoire seulement pour le motif Autre
    reason: string | null;
    created_at: string;
}

export interface CashSession {
    id: number;
    // YYYY-MM-DD
    session_date: string;
    status: "OPEN" | "CLOSED";
    // null pour le gérant quand la caisse est ouverte et la clôture à l'aveugle
    opening_amount: number | null;
    // les trois montants suivants restent vides tant que la session est ouverte
    theoretical_amount: number | null;
    actual_amount: number | null;
    difference: number | null;
    opened_at: string;
    closed_at: string | null;
    opened_by_name: string | null;
    closed_by_name: string | null;
    // explication de l'écart donnée à la clôture
    closing_note: string | null;
    // écart découvert après une clôture à l'aveugle, pas encore expliqué
    explanation_pending: boolean;
    closed_by: number | null;
    // présent quand le serveur a masqué les montants (clôture à l'aveugle)
    blind?: boolean;
}

export interface CashSessionDetail extends CashSession {
    movements: CashMovement[];
}

export interface CashSessionPage {
    data: CashSession[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

// partie caisse de /dashboard/summary
// balance et openingAmount valent null pour le gérant quand la clôture est à l'aveugle
export interface CashToday {
    cash: {
        id: number;
        status: "OPEN" | "CLOSED";
        openingAmount: number | null;
        balance: number | null;
        openedAt: string;
        openedByName: string | null;
        closedAt: string | null;
    } | null;
    previousOpenSession: {
        id: number;
        sessionDate: string;
        openedAt: string;
        balance: number | null;
    } | null;
    pendingExplanation: {
        id: number;
        sessionDate: string;
        difference: number;
        closedBy: number;
    } | null;
    blindClose: boolean;
}

// réponse de la clôture, utile pour révéler l'écart après un comptage à l'aveugle
export interface ClosedCash {
    id: number;
    difference: number;
    explanation_pending: boolean;
}

export interface CashMovementRow extends CashMovement {
    session_id: number | null;
}

export interface CashMovementFilters {
    type: CashMovementType | null;
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    category: string | null;
    page: number;
    limit: number;
}

export interface CashMovementPage {
    data: CashMovementRow[];
    summary: { totalIn: number; totalOut: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

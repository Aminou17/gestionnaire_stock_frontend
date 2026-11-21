export interface AuditLog {
    id: number;
    user_id: number | null;
    user_name: string | null;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    // nom actuel du produit, de la catégorie, du fournisseur ou de l'utilisateur concerné
    entity_name?: string | null;
    details: Record<string, unknown> | null;
    result: "SUCCESS" | "FAILURE";
    ip_address: string | null;
    created_at: string;
}

export interface AuditLogPage {
    data: AuditLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuditLogFilters {
    from: string | null;
    to: string | null;
    userId: number | null;
    action: string | null;
    result: "FAILURE" | null;
    category?: AuditCategory | null;
    search?: string | null;
    page: number;
    limit: number;
}

// Sécurité : connexions, mots de passe, accès refusés. Activité : tout le reste.
export type AuditCategory = "activity" | "security";

// même liste que le backend (auditLog.model.js)
export const SECURITY_ACTIONS = [
    "AUTH_LOGIN_SUCCEEDED",
    "AUTH_LOGIN_FAILED",
    "AUTH_LOGOUT_ALL",
    "ACCESS_DENIED",
    "PASSWORD_CHANGED",
    "PASSWORD_CHANGE_FAILED",
    "USER_PASSWORD_RESET",
    "PASSWORD_RESET_REQUESTED",
    "PASSWORD_RESET_COMPLETED",
    "SHOP_ADMIN_RESET_LINK_SENT",
    "SHOP_ADMIN_TEMP_PASSWORD_SET",
    "TWO_FACTOR_ENABLED",
    "TWO_FACTOR_DISABLED",
    "TWO_FACTOR_FAILED",
];

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface Page<T> {
    data: T[];
    pagination: Pagination;
}

export interface SecurityOverview {
    failedLogins24h: number;
    failedLogins7d: number;
    accessDenied7d: number;
    lockedAccounts: number;
    topShops: { id: number; name: string; failed_logins: number; access_denied: number }[];
    daily: { day: string; failed_logins: number; access_denied: number }[];
}

// connexion échouée : une ligne par tentative
export interface FailedLogin {
    id: number;
    email: string | null;
    ip_address: string | null;
    shop_id: number | null;
    shop_name: string | null;
    created_at: string;
    suspicious: boolean;
}

// connexions échouées regroupées par adresse IP
export interface FailedLoginIp {
    ip_address: string | null;
    attempts: number;
    emails: number;
    shops: number;
    last_attempt_at: string;
    suspicious: boolean;
}

export interface LockedAccount {
    id: number;
    name: string;
    email: string;
    role: string;
    shop_name: string | null;
    failed_logins: number;
    locked_until: string;
}

// accès refusé, changement ou réinitialisation de mot de passe
export interface SecurityEvent {
    id: number;
    action: string;
    result: "SUCCESS" | "FAILURE";
    details: Record<string, unknown> | null;
    email: string | null;
    user_name: string | null;
    ip_address: string | null;
    shop_name: string | null;
    created_at: string;
}

// filtres communs aux listes ; les champs inutiles pour une liste sont ignorés
export interface SecurityFilters {
    shopId: number | null;
    email: string;
    ip: string;
    from: string | null;
    to: string | null;
}

export const NO_FILTERS: SecurityFilters = {
    shopId: null,
    email: "",
    ip: "",
    from: null,
    to: null,
};

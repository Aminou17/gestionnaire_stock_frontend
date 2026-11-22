export type ShopStatus = "ACTIVE" | "SUSPENDED";

// une boutique cliente vue par le propriétaire : son activité, jamais ses montants
export interface OwnedShop {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
    // date de suppression : la boutique est effacée pour de bon 90 jours plus tard
    deleted_at: string | null;
    trial_ends_at: string | null;
    // dernier jour payé inclus (AAAA-MM-JJ)
    paid_until: string | null;
    // premier instant sans accès, calculé par l'API
    access_ends_at: string | null;
    admin_name: string | null;
    admin_email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    users_count: number;
    // les vendeurs créés par l'administrateur, sans lui
    employees_count: number;
    employees: string[];
    sales_last_30_days: number;
    last_sale_at: string | null;
}

export interface NewShopInput {
    shopName: string;
    adminName: string;
    phone?: string;
    country?: string;
    city?: string;
    address?: string;
    email: string;
    password: string;
    // absent : pas d'essai
    trialDays?: number;
}

export interface CreatedShop {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
    trial_ends_at: string | null;
    admin: { id: number; name: string; email: string; role: "admin" };
}

export interface ShopAccount {
    id: number;
    name: string;
    email: string;
    role: "admin" | "manager";
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
}

// la fiche d'une boutique : contact, comptes et activité, jamais les montants
export interface OwnedShopDetail {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
    deleted_at: string | null;
    trial_ends_at: string | null;
    paid_until: string | null;
    access_ends_at: string | null;
    phone: string | null;
    address: string | null;
    country: string | null;
    city: string | null;
    tax_id: string | null;
    rccm: string | null;
    products_count: number;
    customers_count: number;
    suppliers_count: number;
    sales_total: number;
    sales_last_30_days: number;
    last_sale_at: string | null;
    last_login_at: string | null;
    users: ShopAccount[];
}

export interface TemporaryPassword {
    user: { id: number; name: string; email: string };
    password: string;
}

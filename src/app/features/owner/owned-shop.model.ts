export type ShopStatus = "ACTIVE" | "SUSPENDED";

// une boutique cliente vue par le propriétaire : son activité, jamais ses montants
export interface OwnedShop {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
    trial_ends_at: string | null;
    admin_name: string | null;
    admin_email: string | null;
    users_count: number;
    sales_last_30_days: number;
    last_sale_at: string | null;
}

export interface NewShopInput {
    shopName: string;
    adminName: string;
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
    trial_ends_at: string | null;
    phone: string | null;
    address: string | null;
    products_count: number;
    sales_last_30_days: number;
    last_sale_at: string | null;
    users: ShopAccount[];
}

export interface TemporaryPassword {
    user: { id: number; name: string; email: string };
    password: string;
}

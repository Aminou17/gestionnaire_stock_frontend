export type ShopStatus = "ACTIVE" | "SUSPENDED";

// une boutique cliente vue par le propriétaire : son activité, jamais ses montants
export interface OwnedShop {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
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
}

export interface CreatedShop {
    id: number;
    name: string;
    status: ShopStatus;
    created_at: string;
    admin: { id: number; name: string; email: string; role: "admin" };
}

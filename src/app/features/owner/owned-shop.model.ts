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
    last_login_at: string | null;
    users: ShopAccount[];
}

export interface TemporaryPassword {
    user: { id: number; name: string; email: string };
    password: string;
}

// marge d'une boutique sur une période : pour réfléchir à un tarif, jamais le détail des ventes
export interface ShopMargin {
    shop_id: number;
    name: string;
    sales_count: number;
    revenue: number;
    cost: number;
    margin: number;
    // marge sur le chiffre d'affaires, en pourcentage ; null sans vente
    margin_rate: number | null;
}

export interface MarginReport {
    days: number;
    rows: ShopMargin[];
}

// pages ouvertes dans une boutique un jour donné (AAAA-MM-JJ)
export interface UsageDay {
    shop_id: number;
    day: string;
    views: number;
    // la part ouverte par les vendeurs
    employee_views: number | null;
}

export interface UsageReport {
    days: number;
    rows: UsageDay[];
}

export interface UsagePage {
    page: string;
    views: number;
    employee_views: number | null;
}

export interface ShopUsage {
    days: number;
    daily: UsageDay[];
    pages: UsagePage[];
}

// un accès que le propriétaire peut cocher pour une boutique (formule)
export interface ShopModule {
    key: string;
    group: string;
    label: string;
    description: string;
    enabled: boolean;
}

export interface ShopModules {
    // ce que toute boutique a, quoi qu'il arrive
    core: string[];
    modules: ShopModule[];
}

// la page Abonnement est-elle ouverte aux boutiques ?
export interface SubscriptionsState {
    enabled: boolean;
    // dernier changement ; null si jamais activés
    changedAt: string | null;
}

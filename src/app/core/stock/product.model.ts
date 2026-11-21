export type PricingMode = "FIXED" | "NEGOTIABLE";
export type StockStatus = "OK" | "LOW" | "OUT_OF_STOCK";
export type ProductStatus = "active" | "deleted" | "all";

export interface Product {
    id: number;
    name: string;
    category_name: string | null;
    // envoyé seulement à l'admin
    purchase_price?: number;
    sale_price: number;
    pricing_mode: PricingMode;
    max_discount: number;
    theoretical_stock: number;
    is_active: boolean;
    // code EAN, UPC ou interne, null sans code
    barcode?: string | null;
    // petite image en data URL, null sans photo
    image?: string | null;
    // seuil propre au produit, null = seuil général
    min_stock: number | null;
    effective_min_stock: number | null;
    stock_status: StockStatus;
    // ventes nettes des 30 derniers jours
    sold_last_30_days?: number;
}

export interface ProductDetail extends Product {
    category_id: number;
    // envoyé seulement à l'admin
    supplier_id?: number;
    // null pour les produits créés avant l'ajout de la date
    created_at: string | null;
}

export interface ProductCounters {
    total_products: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    // valeur au prix d'achat, envoyée seulement à l'admin
    stock_value?: number;
}

export interface ProductPage {
    data: Product[];
    total: number;
    counters: ProductCounters;
}

export type ProductSort =
    | "default"
    | "recent"
    | "name"
    | "price_asc"
    | "price_desc"
    | "stock_asc"
    | "sold_desc"
    | "sold_asc";

export interface ProductFilters {
    search: string;
    sort?: ProductSort;
    categoryId: number | null;
    supplierId?: number | null;
    stockStatus: StockStatus | null;
    status: ProductStatus;
    page: number;
    limit: number;
}

export interface ProductInput {
    name: string;
    categoryId: number | null;
    supplierId: number | null;
    purchasePrice: number;
    salePrice: number;
    pricingMode: PricingMode;
    maxDiscount: number;
    minStock: number | null;
    // vide : aucun code-barres
    barcode?: string | null;
}

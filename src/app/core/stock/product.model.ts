export type PricingMode = "FIXED" | "NEGOTIABLE";
export type StockStatus = "OK" | "LOW" | "OUT_OF_STOCK";
export type ProductStatus = "active" | "deleted" | "all";

export interface Product {
    id: number;
    name: string;
    category_name: string;
    // envoyé seulement à l'admin
    purchase_price?: number;
    sale_price: number;
    pricing_mode: PricingMode;
    max_discount: number;
    theoretical_stock: number;
    is_active: boolean;
    // seuil propre au produit, null = seuil général
    min_stock: number | null;
    effective_min_stock: number | null;
    stock_status: StockStatus;
}

export interface ProductDetail extends Product {
    category_id: number;
    supplier_id: number;
    // null pour les produits créés avant l'ajout de la date
    created_at: string | null;
}

export interface ProductCounters {
    total_products: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
}

export interface ProductPage {
    data: Product[];
    total: number;
    counters: ProductCounters;
}

export interface ProductFilters {
    search: string;
    categoryId: number | null;
    supplierId?: number | null;
    stockStatus: StockStatus | null;
    status: ProductStatus;
    page: number;
    limit: number;
}

export interface ProductInput {
    name: string;
    categoryId: number;
    supplierId: number;
    purchasePrice: number;
    salePrice: number;
    pricingMode: PricingMode;
    maxDiscount: number;
    minStock: number | null;
}

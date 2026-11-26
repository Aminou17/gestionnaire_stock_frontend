export interface StockEntry {
    id: number;
    product_id: number;
    product_name: string;
    // Miniature en data URL, null sans photo
    image?: string | null;
    supplier_id: number;
    supplier_name: string;
    user_id: number;
    user_name: string | null;
    quantity: number;
    date_creation: string;
}

// Totaux de la période et des filtres choisis
export interface StockEntryCounters {
    entries: number;
    units: number;
    products: number;
    suppliers: number;
}

export interface StockEntryPage {
    data: StockEntry[];
    total: number;
    counters: StockEntryCounters;
}

export interface StockEntryFilters {
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    supplierId: number | null;
    page: number;
    limit: number;
}

export interface StockEntryInput {
    productId: number;
    supplierId: number;
    quantity: number;
}

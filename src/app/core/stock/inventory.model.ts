export interface Inventory {
    id: number;
    user_id: number;
    user_name: string | null;
    created_at: string;
    // null tant que les écarts n'ont pas été appliqués au stock
    applied_at: string | null;
    applied_by_name: string | null;
    items_count: number;
    // valeur des écarts au prix d'achat actuel, négative quand il manque du stock
    difference_value: number;
}

export interface InventoryItem {
    id: number;
    product_id: number;
    product_name: string;
    theoretical_stock: number;
    actual_stock: number;
    // stock réel moins stock théorique
    difference: number;
    purchase_price: number;
}

export interface InventoryDetail extends Inventory {
    items: InventoryItem[];
}

export interface NewInventoryItem {
    productId: number;
    actualStock: number;
}

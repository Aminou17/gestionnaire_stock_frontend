export interface Category {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    // null pour les catégories créées avant l'ajout de la date
    created_at: string | null;
    // Nombre de produits actifs rangés dans la catégorie
    product_count: number;
}

// Dernière action enregistrée sur la catégorie (journal d'audit)
export interface CategoryChange {
    action: string;
    at: string;
    // null si l'utilisateur a été supprimé
    user_name: string | null;
}

// Fiche d'une catégorie : la liste, plus l'état du stock de ses produits
export interface CategoryDetail extends Category {
    // Nombre total d'articles en stock
    total_stock: number;
    low_stock_count: number;
    out_of_stock_count: number;
    // Envoyés seulement à l'admin
    stock_value?: number;
    last_change?: CategoryChange | null;
}

export interface LowStockAlert {
    id: number;
    name: string;
    // miniature du produit, null sans photo
    image?: string | null;
    theoretical_stock: number;
    min_stock: number;
    sold_last_30_days: number;
    // null quand le produit ne s'est pas vendu depuis 30 jours
    days_left: number | null;
    category_id: number | null;
    category_name: string | null;
    supplier_id: number | null;
    supplier_name: string | null;
    supplier_contact: string | null;
    supplier_phone: string | null;
    // dernière entrée de stock du produit, null s'il n'en a jamais eu
    last_entry_at: string | null;
    last_entry_quantity: number | null;
    status: "OUT_OF_STOCK" | "LOW";
    // de quoi tenir un mois de ventes, au moins le double du seuil
    suggested_quantity: number;
}

export interface SnoozedAlert {
    id: number;
    name: string;
    theoretical_stock: number;
    // date de reprise de l'alerte
    snoozed_until: string;
}

export type SnoozeDays = 7 | 30 | 90;

export type RotationSpeed = "FAST" | "NORMAL" | "SLOW" | "DORMANT";

export interface ProductRotation {
    id: number;
    name: string;
    // miniature du produit, null sans photo
    image?: string | null;
    category_name: string | null;
    theoretical_stock: number;
    sold_last_30_days: number;
    // null quand le produit ne s'est pas vendu depuis 30 jours
    days_left: number | null;
    speed: RotationSpeed;
    last_sale_at: string | null;
    // jours depuis la dernière vente, ou depuis la création si le produit ne s'est jamais vendu
    idle_days: number | null;
    // en stock et sans vente depuis 60 jours
    to_clear: boolean;
}

export interface Supplier {
    id: number;
    name: string;
    // Personne à contacter chez le fournisseur
    contact: string | null;
    telephone: string | null;
    email: string | null;
    address: string | null;
    created_at: string | null;
    is_active: boolean;
    // Absent des réponses de création, modification et restauration
    product_count?: number;
}

// Champs envoyés à la création et à la modification (vide = null)
export interface SupplierInput {
    name: string;
    contact?: string | null;
    telephone?: string | null;
    email?: string | null;
    address?: string | null;
}

export type SupplierStatus = "active" | "deleted" | "all";

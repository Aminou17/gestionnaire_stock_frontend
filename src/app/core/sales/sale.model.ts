import { StockMovement } from "../stock/stock-movement.model";

export type SaleStatus = "ACTIVE" | "CANCELLED";

// seules les espèces passent par le tiroir-caisse
export type PaymentMethod = "CASH" | "MOBILE_MONEY";

export interface NewSalePayment {
    paymentMethod: PaymentMethod;
    // espèces seulement, pour calculer la monnaie rendue
    amountReceived?: number;
    // mobile money seulement, le numéro de la transaction
    // acompte : montant payé maintenant, absent = vente payée en totalité
    amountPaid?: number;
    // fiche client : le backend en tire le nom et le téléphone
    customerId?: number;
    customerName?: string;
    customerPhone?: string;
    // second mode de paiement : le reste du total payé autrement
    secondPayment?: {
        paymentMethod: PaymentMethod;
        amountPaid: number;
    };
}

export interface Sale {
    id: number;
    // numéro de la vente dans la boutique, celui affiché et imprimé ; id sert aux liens
    number: number;
    user_id: number;
    user_name: string | null;
    user_role: "admin" | "manager" | null;
    // seulement sur la fiche d'une vente
    user_avatar?: string | null;
    total: number;
    payment_method?: PaymentMethod;
    // null pour une vente sans fiche client
    customer_id?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    // déjà encaissé : le reste à payer est total - paid_amount
    paid_amount: number;
    status: SaleStatus;
    items_count: number;
    created_at: string;
    cancelled_at: string | null;
}

export interface SaleItem {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    reference_price: number;
    // réduction accordée sur chaque unité
    discount_amount: number;
}

export interface SalePayment {
    id: number;
    amount: number;
    payment_method: PaymentMethod;
    amount_received: number | null;
    user_name: string | null;
    created_at: string;
}

export interface SaleReturn {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    amount: number;
    cash_refunded: number;
    other_refunded: number;
    reason: string;
    user_name: string | null;
    created_at: string;
}

export interface SaleDetail extends Omit<Sale, "items_count"> {
    payment_method: PaymentMethod;
    amount_received: number | null;
    cancellation_reason: string | null;
    cancelled_by_name: string | null;
    items: SaleItem[];
    payments: SalePayment[];
    // retours partiels d'articles, déjà remboursés au client
    returns: SaleReturn[];
    returned_amount: number;
    // la vente puis son remboursement éventuel, avec le stock après chacun
    movements: StockMovement[];
    // ventes voisines, null s'il n'y en a pas (le manager ne voit que les siennes)
    previous_id: number | null;
    next_id: number | null;
}

// compteurs de la période choisie, quel que soit le statut filtré
export interface SaleCounters {
    all: number;
    active: number;
    cancelled: number;
    active_total: number;
    // ventes validées pas encore soldées, et reste à encaisser sur elles
    unpaid: number;
    due_total: number;
    // total rendu aux clients sur les ventes remboursées
    cancelled_total: number;
}

export interface SalePage {
    data: Sale[];
    total: number;
    counters: SaleCounters;
}

export interface SaleFilters {
    status: SaleStatus | null;
    // YYYY-MM-DD, bornes incluses
    from: string | null;
    to: string | null;
    page: number;
    limit: number;
    paymentMethod?: PaymentMethod | null;
    // seulement les ventes validées pas encore soldées
    unpaid?: boolean;
    // admin seulement : le manager ne voit que ses ventes
    sellerId?: number | null;
    // numéro de vente ou nom du vendeur
    search?: string;
}

// unitPrice seulement pour un produit négociable
export interface NewSaleItem {
    productId: number;
    quantity: number;
    unitPrice?: number;
}

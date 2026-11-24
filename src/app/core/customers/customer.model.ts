export interface Customer {
    id: number;
    name: string;
    phone: string | null;
    note: string | null;
    is_active: boolean;
    created_at: string;
    // ventes non annulées
    purchases_count: number;
    // chiffre d'affaires du client : ventes moins retours, jamais de marge
    total_spent: number;
    due_amount: number;
    // null tant que le client n'a rien acheté
    last_purchase_at: string | null;
    // date de la plus ancienne vente non soldée, null sans dette
    oldest_due_at?: string | null;
}

// champs envoyés à la création et à la modification (vide = null)
export interface CustomerInput {
    name: string;
    phone: string | null;
    note: string | null;
}

export type CustomerStatus = "active" | "inactive" | "all";

export type CustomerSort = "recent" | "name" | "spent" | "due" | "oldest_due";

export interface CustomerFilters {
    search: string;
    status: CustomerStatus;
    unpaid: boolean;
    sort: CustomerSort;
    page: number;
    limit: number;
}

export interface Paged<T> {
    rows: T[];
    total: number;
    page: number;
    limit: number;
}

// due_total : somme des restes à payer de tous les clients trouvés, pas seulement ceux de la page
export type CustomerPage = Paged<Customer> & { due_total?: number };

export interface CustomerSale {
    id: number;
    number: number;
    created_at: string;
    status: "ACTIVE" | "CANCELLED";
    total: number;
    paid_amount: number;
    returned_amount: number;
    payment_method: "CASH" | "MOBILE_MONEY";
    user_name: string | null;
    items_count: number;
}

// le numéro est déjà pris : la fiche qui le porte est jointe à l'erreur 409
export interface DuplicatePhone {
    id: number;
    name: string;
    is_active: boolean;
}

// ce que le serveur a réparti après un paiement : une part par vente soldée ou entamée
export interface CustomerPayment {
    amount: number;
    remaining: number;
    sales: { id: number; amount: number }[];
}

// un paiement encaissé depuis la fiche, avec les ventes qu'il a payées
export interface CustomerPaymentRecord {
    id: number;
    amount: number;
    remaining_after: number;
    payment_method: "CASH" | "MOBILE_MONEY";
    created_at: string;
    user_name: string | null;
    sales: { id: number; number: number; amount: number }[];
}

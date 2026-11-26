export type ThreadStatus = "OPEN" | "CLOSED";

export interface SupportThread {
    id: number;
    subject: string;
    status: ThreadStatus;
    owner_unread: boolean;
    user_unread: boolean;
    created_at: string;
    updated_at: string;
    last_message: string | null;
    // Seulement dans la vue du propriétaire
    shop_name?: string;
    user_name?: string;
    user_email?: string;
}

export interface SupportMessage {
    id: number;
    sender: "user" | "owner";
    body: string;
    created_at: string;
}

export interface SupportThreadDetail extends SupportThread {
    messages: SupportMessage[];
}

// Qui regarde l'écran : l'utilisateur d'une boutique ou le propriétaire du logiciel
export type SupportSide = "user" | "owner";

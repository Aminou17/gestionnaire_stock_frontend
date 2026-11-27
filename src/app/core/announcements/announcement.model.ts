export type AnnouncementAction = "shop" | "products";

// Les accusés d'une boutique pour un message
export interface Receipts {
    received_at: string | null;
    read_at: string | null;
    replied_at: string | null;
    thread_id: number | null;
}

// Message reçu par une boutique
export interface ShopAnnouncement {
    id: number;
    subject: string;
    body: string;
    action: AnnouncementAction | null;
    send_at: string;
    read_at: string | null;
    replied_at: string | null;
    thread_id: number | null;
}

// Envoi vu par le propriétaire, avec ses totaux
export interface OwnerAnnouncement {
    id: number;
    subject: string;
    body: string;
    action: AnnouncementAction | null;
    audience: "ALL" | "SELECTED";
    send_at: string;
    scheduled: boolean;
    total: number;
    received: number;
    read: number;
    replied: number;
}

export interface AnnouncementRecipient extends Receipts {
    shop_id: number;
    shop_name: string;
}

export interface OwnerAnnouncementDetail extends OwnerAnnouncement {
    recipients: AnnouncementRecipient[];
}

// Ligne de l'historique d'une boutique
export interface ShopHistoryEntry extends Receipts {
    id: number;
    kind: "MANUAL" | "WELCOME" | "REMINDER" | "SUBSCRIPTION";
    subject: string;
    send_at: string;
    scheduled: boolean;
}

export interface AnnouncementInput {
    subject: string;
    body: string;
    action: AnnouncementAction | null;
    audience: "ALL" | "SELECTED";
    shopIds: number[];
    // null : envoi immédiat
    sendAt: string | null;
}

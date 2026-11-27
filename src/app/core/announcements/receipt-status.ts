import { Receipts } from "./announcement.model";

export interface ReceiptStatus {
    label: string;
    badge: "neutral" | "primary" | "warning" | "success" | "violet";
}

// L'étape la plus avancée atteinte par une boutique
export function receiptStatus(receipts: Receipts, scheduled = false): ReceiptStatus {
    if (scheduled) return { label: "Programmé", badge: "violet" };
    if (receipts.replied_at) return { label: "A répondu", badge: "success" };
    if (receipts.read_at) return { label: "Lu, sans réponse", badge: "primary" };
    if (receipts.received_at) return { label: "Reçu, pas lu", badge: "warning" };
    return { label: "Pas encore reçu", badge: "neutral" };
}

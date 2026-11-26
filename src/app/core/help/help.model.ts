export type HelpReason = "login" | "blocked" | "payment" | "other";

export interface HelpRequestInput {
    name: string;
    email: string;
    shopName?: string;
    reason: HelpReason;
    message: string;
    // Pièges à robots : champ caché et temps passé sur le formulaire
    website?: string;
    elapsedMs?: number;
}

// Demande reçue depuis la page de connexion, vue par le propriétaire
export interface HelpRequest {
    id: number;
    name: string;
    email: string;
    shop_name: string | null;
    reason: HelpReason;
    message: string;
    status: "OPEN" | "CLOSED";
    reply: string | null;
    replied_at: string | null;
    created_at: string;
}

export const HELP_REASONS: { value: HelpReason; label: string }[] = [
    { value: "login", label: "Je n'arrive pas à me connecter" },
    { value: "blocked", label: "Mon compte est bloqué ou suspendu" },
    { value: "payment", label: "Paiement ou abonnement" },
    { value: "other", label: "Autre question" },
];

export const helpReasonLabel = (reason: HelpReason) =>
    HELP_REASONS.find((r) => r.value === reason)?.label ?? reason;

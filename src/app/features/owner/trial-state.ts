// État d'accès d'une boutique pour son étiquette : essai, payé, délai de grâce, terminé
// (même règle que l'API : la plus tardive de la fin d'essai et du lendemain du dernier jour payé, puis 3 jours de grâce)
const DAY = 86_400_000;
export const GRACE_DAYS = 3;

export type AccessTone = "ok" | "info" | "warn" | "ended";

export interface AccessLabel {
    label: string;
    tone: AccessTone;
    // Compatibilité avec les anciennes étiquettes d'essai
    ended: boolean;
}

const shortDate = (date: Date) =>
    date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export const accessStateOf = (shop: {
    trial_ends_at: string | null;
    paid_until?: string | null;
    access_ends_at?: string | null;
}): AccessLabel | null => {
    const endsAt = shop.access_ends_at ?? shop.trial_ends_at;
    if (!endsAt) return null;

    const ends = new Date(endsAt).getTime();
    const left = ends - Date.now();
    const paid =
        !!shop.paid_until && (!shop.trial_ends_at || ends > new Date(shop.trial_ends_at).getTime());

    if (left > 0) {
        if (paid) {
            const lastDay = new Date(ends - 1000);
            return { label: `Payé jusqu'au ${shortDate(lastDay)}`, tone: "ok", ended: false };
        }
        const days = Math.ceil(left / DAY);
        return {
            label: `Essai : ${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`,
            tone: days <= 7 ? "warn" : "info",
            ended: false,
        };
    }

    if (-left < GRACE_DAYS * DAY) {
        return { label: "Échéance passée, délai de grâce", tone: "warn", ended: false };
    }

    return { label: paid ? "Abonnement expiré" : "Essai terminé", tone: "ended", ended: true };
};

// Ancien nom, gardé pour les écrans qui n'ont que la fin d'essai
export const trialStateOf = (trialEndsAt: string | null) =>
    accessStateOf({ trial_ends_at: trialEndsAt });

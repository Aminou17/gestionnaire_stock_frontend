// essai en cours, terminé ou absent, pour l'étiquette d'une boutique
export const trialStateOf = (trialEndsAt: string | null): { label: string; ended: boolean } | null => {
    if (!trialEndsAt) return null;

    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
    if (days <= 0) return { label: "Essai terminé", ended: true };

    return {
        label: `Essai : ${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`,
        ended: false,
    };
};

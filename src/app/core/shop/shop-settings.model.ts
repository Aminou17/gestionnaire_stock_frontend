// Informations imprimées sur les tickets de caisse
export interface ShopSettings {
    name: string;
    address: string | null;
    phone: string | null;
    // Numéro IFU
    tax_id: string | null;
    rccm: string | null;
    // Message en bas du ticket, la politique de retour par exemple
    receipt_footer: string | null;
    // Image PNG ou JPEG en data URL, imprimée en haut du ticket
    logo: string | null;
    // Chiffres seuls, sans + (242, 226)
    default_country_code: string;
    updated_at: string | null;
    // Fin de l'essai gratuit ; absent ou null : pas d'essai en cours
    trial_ends_at?: string | null;
    // Le propriétaire a activé les abonnements : la page Abonnement existe
    subscriptions_enabled?: boolean;
    // Accès retirés à cette boutique par le propriétaire (clés)
    disabled_modules?: string[];
}

export interface ShopSettingsInput {
    name: string;
    address: string;
    phone: string;
    taxId: string;
    rccm: string;
    receiptFooter: string;
    defaultCountryCode?: string;
}

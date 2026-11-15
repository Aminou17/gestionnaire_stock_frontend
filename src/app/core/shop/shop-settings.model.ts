// informations imprimées sur les tickets de caisse
export interface ShopSettings {
    name: string;
    address: string | null;
    phone: string | null;
    // numéro IFU
    tax_id: string | null;
    rccm: string | null;
    // message en bas du ticket, la politique de retour par exemple
    receipt_footer: string | null;
    // image PNG ou JPEG en data URL, imprimée en haut du ticket
    logo: string | null;
    // chiffres seuls, sans + (242, 226)
    default_country_code: string;
    updated_at: string | null;
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

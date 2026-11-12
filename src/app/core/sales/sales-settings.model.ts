// réglages des ventes choisis par le propriétaire
export interface SalesSettings {
    // texte devant le numéro du ticket, vide si aucun
    ticket_prefix: string;
    // remise maximale préremplie à la création d'un produit négociable
    default_max_discount: number | null;
    updated_at: string | null;
}

export interface SalesSettingsInput {
    ticketPrefix: string;
    defaultMaxDiscount: number | null;
}

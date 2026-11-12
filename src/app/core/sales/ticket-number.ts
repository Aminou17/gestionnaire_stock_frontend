// numéro imprimé sur le ticket : identifiant sur 6 chiffres (9 devient 000009),
// précédé du préfixe choisi par le propriétaire (AB donne AB-000009)
export const formatTicketNumber = (id: number | string, prefix = "") => {
    const number = String(id).padStart(6, "0");

    return prefix ? `${prefix}-${number}` : number;
};

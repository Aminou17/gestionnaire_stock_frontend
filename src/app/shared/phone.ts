import { COUNTRY_NAMES } from "./country-codes";

// Un numéro est enregistré en format international (+226 66 09 90 60). Les anciens numéros n'ont
// pas de "+" : on leur donne l'indicatif par défaut de la boutique (réglage Paramètres).
export const DEFAULT_COUNTRY_CODE = "242";

const digitsOf = (phone: string) => phone.replace(/\D/g, "");

// vrai pour +226... et 00226...
const isInternational = (phone: string) => /^\s*(\+|00)/.test(phone);

// chiffres avec l'indicatif devant, jamais de + ni de 00
const internationalDigits = (phone: string, defaultCode: string) => {
    const digits = digitsOf(phone);

    if (isInternational(phone)) return digits.replace(/^00/, "");
    // un numéro de plus de 9 chiffres qui commence par l'indicatif l'a déjà
    if (digits.startsWith(defaultCode) && digits.length > 9) return digits;

    return defaultCode + digits;
};

// même numéro avec ou sans l'indicatif de la boutique : même clé (comme l'unicité côté API)
export const phoneKey = (phone: string, defaultCode: string) =>
    digitsOf(phone) ? internationalDigits(phone, defaultCode) : "";

// Sépare l'indicatif du numéro. Sans "+", l'indicatif est celui de la boutique.
export const splitPhone = (phone: string, defaultCode: string) => {
    const full = internationalDigits(phone, defaultCode);

    if (full.startsWith(defaultCode))
        return { code: defaultCode, national: full.slice(defaultCode.length) };

    // indicatif de 3, 2 puis 1 chiffre : le plus long connu gagne
    for (const length of [3, 2, 1]) {
        const code = full.slice(0, length);
        if (COUNTRY_NAMES[code]) return { code, national: full.slice(length) };
    }

    return { code: full.slice(0, 3), national: full.slice(3) };
};

// 06 123 45 67 (Congo, 9 chiffres avec 0), 66 09 90 60 (8 chiffres), sinon par paires
export const groupNational = (national: string) => {
    if (national.length === 9 && national.startsWith("0")) {
        return national.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4");
    }

    // nombre impair de chiffres : le premier reste seul, comme 6 12 34 56 78
    const lead = national.length % 2 ? `${national[0]} ` : "";
    return lead + (national.slice(lead ? 1 : 0).match(/\d{1,2}/g) ?? []).join(" ");
};

// la valeur enregistrée quand l'utilisateur passe par le champ indicatif + numéro
export const toInternational = (code: string, national: string) => {
    const digits = digitsOf(national);
    return digits ? `+${code} ${groupNational(digits)}` : "";
};

// numéro tapé librement (caisse, ancien format) mis au format international
export const normalizePhone = (phone: string, defaultCode: string) => {
    const { code, national } = splitPhone(phone, defaultCode);
    return toInternational(code, national);
};

export const formatPhone = (phone: string, defaultCode = DEFAULT_COUNTRY_CODE) => {
    const { code, national } = splitPhone(phone, defaultCode);

    // numéro d'un autre pays : on le montre complet, tel qu'il a été saisi
    if (code !== defaultCode) return phone;

    if (national.length === 9 && national.startsWith("0")) return groupNational(national);
    if (national.length === 8) return groupNational(national);

    return phone;
};

// toujours avec l'indicatif du pays : +226 66 09 90 60
export const formatInternational = (phone: string, defaultCode = DEFAULT_COUNTRY_CODE) => {
    const { code, national } = splitPhone(phone, defaultCode);
    return `+${code} ${groupNational(national)}`;
};

export const toTelLink = (phone: string, defaultCode: string) =>
    `tel:+${internationalDigits(phone, defaultCode)}`;

// text : message déjà écrit dans la conversation, à envoyer d'un geste
export const toWhatsAppLink = (phone: string, defaultCode: string, text?: string) => {
    const number = internationalDigits(phone, defaultCode);

    return text
        ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
        : `https://wa.me/${number}`;
};

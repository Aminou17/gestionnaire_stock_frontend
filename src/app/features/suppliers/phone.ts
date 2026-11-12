// Numéros du Congo : 9 chiffres commençant par 0 (06 123 45 67), indicatif 242
const digitsOf = (phone: string) => phone.replace(/\D/g, "");

// numéro national, sans l'indicatif 242
const nationalDigits = (phone: string) => {
    const digits = digitsOf(phone);
    return digits.startsWith("242") && digits.length > 9 ? digits.slice(3) : digits;
};

export const formatPhone = (phone: string) => {
    const digits = nationalDigits(phone);

    if (digits.length === 9 && digits.startsWith("0")) {
        return digits.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4");
    }
    // autre format : on groupe par deux pour que ça reste lisible
    if (/^\d{8}$/.test(digits)) {
        return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
    }
    return phone;
};

export const toTelLink = (phone: string) => {
    if (phone.trim().startsWith("+")) return `tel:+${digitsOf(phone)}`;
    return `tel:+242${nationalDigits(phone)}`;
};

export const toWhatsAppLink = (phone: string) => {
    if (phone.trim().startsWith("+")) return `https://wa.me/${digitsOf(phone)}`;
    return `https://wa.me/242${nationalDigits(phone)}`;
};

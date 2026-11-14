// le lien WhatsApp veut un numéro international : sans indicatif on met celui du Congo
// au Congo-Brazzaville le 0 initial du numéro reste après l'indicatif
const DIAL_CODE = "242";

export const whatsappLink = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const international = phone.trim().startsWith("+") || digits.startsWith("00");
    const number = international ? digits.replace(/^00/, "") : DIAL_CODE + digits;
    return `https://wa.me/${number}`;
};

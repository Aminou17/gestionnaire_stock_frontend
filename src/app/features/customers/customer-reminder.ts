import { Customer } from "../../core/customers/customer.model";
import { DEFAULT_COUNTRY_CODE, toWhatsAppLink } from "../../shared/phone";

const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// Espaces ordinaires : le message se copie et se lit partout
const amount = (value: number) => `${formatter.format(value).replace(/\s/g, " ")} F`;

export const reminderMessage = (customer: Customer, shopName: string) => {
    const firstName = customer.name.trim().split(/\s+/)[0];
    const sender = shopName ? `de la boutique ${shopName}` : "de la boutique";

    return (
        `Bonjour ${firstName}, c'est ${sender}. ` +
        `Il vous reste ${amount(customer.due_amount)} à régler pour vos achats. ` +
        "Vous pouvez passer ou nous répondre ici quand cela vous arrange. Merci !"
    );
};

// null quand on ne peut pas écrire : pas de numéro, ou rien à relancer
// defaultCode : indicatif de la boutique, pour un numéro sans "+"
export const reminderLink = (
    customer: Customer,
    shopName: string,
    defaultCode = DEFAULT_COUNTRY_CODE,
) => {
    if (!customer.phone || customer.due_amount <= 0) return null;
    return toWhatsAppLink(customer.phone, defaultCode, reminderMessage(customer, shopName));
};

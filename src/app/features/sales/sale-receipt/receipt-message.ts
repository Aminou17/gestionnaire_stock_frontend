import { SaleDetail } from "../../../core/sales/sale.model";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { toWhatsAppLink } from "../../../shared/phone";

const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// espaces ordinaires : le message se copie et se lit partout
const amount = (value: number) => `${formatter.format(value).replace(/\s/g, " ")} F`;

const dateOf = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(iso),
    );

export const receiptMessage = (
    sale: SaleDetail,
    shopName: string,
    ticketPrefix = "",
    announce = "",
) => {
    const lines = [
        shopName || "Ticket de caisse",
        `Ticket n° ${formatTicketNumber(sale.number, ticketPrefix)}, ${dateOf(sale.created_at)}`,
        "",
    ];

    for (const item of sale.items) {
        lines.push(
            `${item.quantity} x ${item.product_name} : ${amount(item.quantity * item.unit_price)}`,
        );
    }

    lines.push("", `Total : ${amount(sale.total)}`);

    if (sale.status === "CANCELLED") {
        lines.push("Vente remboursée");
    } else {
        lines.push(`Payé : ${amount(sale.paid_amount)}`);
        const due = sale.total - sale.paid_amount;
        if (due > 0) lines.push(`Reste à payer : ${amount(due)}`);
    }

    // le bas du ticket est écrit par l'administrateur dans Paramètres
    if (announce.trim()) lines.push("", announce.trim());

    return lines.join("\n");
};

// sans numéro de client, WhatsApp laisse choisir la conversation
export const receiptLink = (
    sale: SaleDetail,
    shopName: string,
    defaultCode: string,
    ticketPrefix = "",
    announce = "",
) => {
    const text = receiptMessage(sale, shopName, ticketPrefix, announce);
    if (sale.customer_phone) return toWhatsAppLink(sale.customer_phone, defaultCode, text);
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

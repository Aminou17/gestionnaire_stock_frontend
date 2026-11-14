import { DatePipe } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { SaleDetail, SalePayment } from "../../../core/sales/sale.model";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { ShopSettings } from "../../../core/shop/shop-settings.model";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Ticket de caisse d'une vente : affiché dans l'aperçu et imprimé à l'identique
@Component({
    selector: "app-sale-receipt",
    imports: [DatePipe, FcfaPipe],
    templateUrl: "./sale-receipt.html",
    styleUrl: "./sale-receipt.css",
})
export class SaleReceipt {
    sale = input.required<SaleDetail>();
    // null tant que les paramètres ne sont pas chargés : le nom par défaut suffit
    shop = input<ShopSettings | null>(null);

    // préfixe des réglages de vente, vide tant qu'ils ne sont pas chargés
    ticketPrefix = input("");

    ticketNumber = computed(() => formatTicketNumber(this.sale().number, this.ticketPrefix()));

    // reste à payer sur une vente validée avec acompte
    due = computed(() =>
        this.sale().status === "ACTIVE" ? this.sale().total - this.sale().paid_amount : 0,
    );

    // monnaie rendue sur un paiement en espèces, 0 si le compte était juste
    changeOf(payment: SalePayment) {
        if (payment.payment_method !== "CASH" || payment.amount_received === null) return 0;
        return Math.max(0, payment.amount_received - payment.amount);
    }

    itemsCount = computed(() => this.sale().items.reduce((sum, item) => sum + item.quantity, 0));
    subtotal = computed(() =>
        this.sale().items.reduce((sum, item) => sum + item.quantity * item.reference_price, 0),
    );
    discounts = computed(() =>
        this.sale().items.reduce((sum, item) => sum + item.quantity * item.discount_amount, 0),
    );
}

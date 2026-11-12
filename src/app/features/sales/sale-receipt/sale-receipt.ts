import { DatePipe } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { SaleDetail } from "../../../core/sales/sale.model";
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

    ticketNumber = computed(() => formatTicketNumber(this.sale().id, this.ticketPrefix()));

    itemsCount = computed(() => this.sale().items.reduce((sum, item) => sum + item.quantity, 0));
    subtotal = computed(() =>
        this.sale().items.reduce((sum, item) => sum + item.quantity * item.reference_price, 0),
    );
    discounts = computed(() =>
        this.sale().items.reduce((sum, item) => sum + item.quantity * item.discount_amount, 0),
    );
}

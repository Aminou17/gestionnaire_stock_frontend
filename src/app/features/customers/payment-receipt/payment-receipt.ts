import { DatePipe } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { CustomerPaymentRecord } from "../../../core/customers/customer.model";
import { ShopSettings } from "../../../core/shop/shop-settings.model";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Ticket d'un paiement de crédit : même papier que le ticket de vente, dont il reprend le style
@Component({
    selector: "app-payment-receipt",
    imports: [DatePipe, FcfaPipe],
    templateUrl: "./payment-receipt.html",
    styleUrl: "../../sales/sale-receipt/sale-receipt.css",
})
export class PaymentReceipt {
    payment = input.required<CustomerPaymentRecord>();
    customerName = input("");
    // null tant que les paramètres ne sont pas chargés : le nom par défaut suffit
    shop = input<ShopSettings | null>(null);

    method = computed(() =>
        this.payment().payment_method === "CASH" ? "Espèces" : "Mobile Money",
    );
}

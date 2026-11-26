import { DatePipe, formatDate } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    LOCALE_ID,
    computed,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { BackState, getBackLink } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import { CustomerPaymentRecord, CustomerSale, Paged } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { PayChoice, PayDialog } from "../../../shared/pay-dialog/pay-dialog";
import { WhatsappIcon } from "../../../shared/icon/whatsapp-icon";
import { Pagination, storedPageSize } from "../../../shared/pagination/pagination";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { formatPhone, toWhatsAppLink } from "../../../shared/phone";
import { productInitials } from "../../products/product-look";
import { CustomerForm } from "../customer-form/customer-form";
import { PaymentReceipt } from "../payment-receipt/payment-receipt";
import { shareReceiptImage } from "../../sales/sale-receipt/receipt-image";
import { ticketUrlLink } from "../../sales/sale-receipt/receipt-message";
import { reminderLink } from "../customer-reminder";

type LoadedSales = Paged<CustomerSale> & { customerId: number };

@Component({
    selector: "app-customer-page",
    imports: [
        RouterLink,
        DatePipe,
        PageHeader,
        Icon,
        WhatsappIcon,
        CustomerForm,
        FcfaPipe,
        Pagination,
        PayDialog,
        PaymentReceipt,
    ],
    templateUrl: "./customer-page.html",
    styleUrl: "./customer-page.css",
})
export class CustomerPage {
    private customerService = inject(CustomerService);
    protected shop = inject(ShopSettingsService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private locale = inject(LOCALE_ID);
    protected auth = inject(AuthService);

    // Un client ouvert depuis une vente ou la caisse revient à cette page
    protected back = getBackLink("/customers", "Retour aux clients");

    private customerForm = viewChild(CustomerForm);
    private confirmDialog = viewChild<ElementRef<HTMLDialogElement>>("confirmBox");

    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());
    protected whatsAppLink = (phone: string) =>
        toWhatsAppLink(phone, this.shop.defaultCountryCode());
    protected initials = productInitials;

    // La vente ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Client" };
    }

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // Un identifiant qui n'est pas un entier n'est même pas demandé au backend
    validId = computed(() => {
        const id = this.id();
        return id !== undefined && Number.isInteger(id) && id > 0;
    });

    customer = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.customerService.getCustomer(params),
    });

    data = computed(() => (this.customer.hasValue() ? this.customer.value() : undefined));

    notFound = computed(
        () =>
            !this.validId() ||
            (this.customer.error() as HttpErrorResponse | undefined)?.status === 404,
    );

    // La fiche peut être réutilisée pour un autre client : on repart de la page 1
    salesPage = linkedSignal({ source: () => this.id(), computation: () => 1 });

    salesPageSize = storedPageSize("customer-sales", 10);

    sales = rxResource({
        params: () =>
            this.validId()
                ? { id: this.id()!, page: this.salesPage(), size: this.salesPageSize() }
                : undefined,
        stream: ({ params }) =>
            this.customerService
                .getCustomerSales(params.id, params.page, params.size)
                .pipe(map((res): LoadedSales => ({ ...res, customerId: params.id }))),
    });

    lastSales = linkedSignal<LoadedSales | undefined, LoadedSales | undefined>({
        source: () => (this.sales.hasValue() ? this.sales.value() : undefined),
        // Les ventes de l'ancien client ne servent pas de repli pour le nouveau
        computation: (next, previous) => {
            if (next) return next;

            return previous?.value?.customerId === this.id() ? previous?.value : undefined;
        },
    });

    // Historique des paiements encaissés : les 5 derniers, puis 10 de plus à chaque « Voir plus »
    paymentsLimit = linkedSignal({ source: () => this.id(), computation: () => 5 });

    payments = rxResource({
        params: () =>
            this.validId() ? { id: this.id()!, limit: this.paymentsLimit() } : undefined,
        stream: ({ params }) => this.customerService.getCustomerPayments(params.id, params.limit),
    });

    paymentList = computed(() => (this.payments.hasValue() ? this.payments.value().rows : []));
    paymentsTotal = computed(() => (this.payments.hasValue() ? this.payments.value().total : 0));

    // Liste des paiements dans une fenêtre : un clic sur un paiement ouvre son détail et son ticket
    paymentsDialog = viewChild.required<ElementRef<HTMLDialogElement>>("paymentsBox");
    selectedPayment = signal<CustomerPaymentRecord | null>(null);
    showTicket = signal(false);

    // « Paiement enregistré » : affiché quand on arrive ici juste après un encaissement
    justPaid = signal(false);
    sharing = signal(false);
    shareNotice = signal("");
    shareError = signal(false);

    private captureBox = viewChild<ElementRef<HTMLElement>>("captureBox");

    // Ouvre la conversation du client avec l'adresse du ticket, qui s'affiche en image dans WhatsApp.
    // sans réseau, l'image du ticket est copiée à la place
    async sendTicket() {
        const payment = this.selectedPayment();
        if (!payment) return;

        this.sharing.set(true);
        this.shareNotice.set("");
        this.shareError.set(false);
        try {
            const { url } = await firstValueFrom(
                this.customerService.getPaymentTicketLink(payment.id),
            );
            window.open(
                ticketUrlLink(this.data()?.phone, this.shop.defaultCountryCode(), url),
                "_blank",
                "noopener",
            );
        } catch {
            await this.sendTicketImage(payment);
        } finally {
            this.sharing.set(false);
        }
    }

    private async sendTicketImage(payment: CustomerPaymentRecord) {
        // On photographie le ticket, pas le bloc qui le décale hors de l'écran
        const box = this.captureBox()?.nativeElement.firstElementChild as HTMLElement | null;
        if (!box) return;

        try {
            const result = await shareReceiptImage(
                box,
                `Ticket-paiement-${payment.id}.png`,
                this.data()?.phone,
                this.shop.defaultCountryCode(),
            );
            if (result === "copied") {
                this.shareNotice.set(
                    "Image copiée, conversation du client ouverte. Collez l'image (Ctrl+V, ou appui long puis Coller).",
                );
            } else if (result === "downloaded") {
                this.shareNotice.set(
                    "Image téléchargée. Glissez-la dans la conversation WhatsApp.",
                );
            }
        } catch {
            this.shareError.set(true);
        }
    }

    openPayments() {
        this.justPaid.set(false);
        this.selectedPayment.set(null);
        this.payments.reload();
        this.paymentsDialog().nativeElement.showModal();
    }

    selectPayment(payment: CustomerPaymentRecord) {
        this.showTicket.set(false);
        this.shareNotice.set("");
        this.shareError.set(false);
        this.selectedPayment.set(payment);
    }

    backToPayments() {
        this.selectedPayment.set(null);
    }

    onPaymentsBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.paymentsDialog().nativeElement.close();
    }

    saleList = computed(() => this.lastSales()?.rows ?? []);

    salesTotal = computed(() => this.lastSales()?.total ?? 0);

    // Historique groupé par mois, du plus récent au plus ancien
    months = computed(() => {
        const months: { key: string; label: string; items: CustomerSale[] }[] = [];

        for (const sale of this.saleList()) {
            const date = new Date(sale.created_at);
            const key = formatDate(date, "yyyy-MM", this.locale);
            let month = months.at(-1);
            if (month?.key !== key) {
                month = { key, label: formatDate(date, "LLLL y", this.locale), items: [] };
                months.push(month);
            }
            month.items.push(sale);
        }
        return months;
    });

    // Lien WhatsApp du rappel, vide sans numéro ou sans dette
    reminder = computed(() => {
        const customer = this.data();
        return customer
            ? reminderLink(customer, this.shop.shopName(), this.shop.defaultCountryCode())
            : null;
    });

    canManage = computed(() => !!this.data()?.is_active);

    // Dette d'une vente non annulée
    due(sale: CustomerSale) {
        return sale.status === "ACTIVE" ? Math.max(sale.total - sale.paid_amount, 0) : 0;
    }

    // Encaisser le crédit : un paiement réparti sur les ventes impayées
    payDialog = viewChild.required<PayDialog>("payBox");
    paying = signal(false);
    payError = signal<string | null>(null);

    askPay() {
        this.payError.set(null);
        this.payDialog().open();
    }

    pay(choice: PayChoice) {
        const customer = this.data();
        if (!customer) return;

        this.paying.set(true);
        this.payError.set(null);

        this.customerService
            .payCustomer(customer.id, {
                paymentMethod: choice.method,
                amountPaid: choice.amount,
                ...(choice.method === "CASH"
                    ? { amountReceived: choice.received ?? choice.amount }
                    : {}),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.paying.set(false);
                    this.payDialog().close();
                    this.customer.reload();
                    this.sales.reload();
                    void this.showNewPayment(customer.id);
                },
                error: (err: HttpErrorResponse) => {
                    this.paying.set(false);
                    this.payError.set(
                        err.error?.message ?? "Impossible d'enregistrer le paiement.",
                    );
                },
            });
    }

    // "Crédit (Depuis N jours)" : ancienneté de la plus vieille vente non soldée
    dueAge = computed(() => {
        const since = this.data()?.oldest_due_at;
        if (!since) return "";

        const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
        if (days <= 0) return "Depuis aujourd'hui";

        return `Depuis ${days} jour${days > 1 ? "s" : ""}`;
    });

    // Après l'encaissement : le paiement tout juste enregistré s'ouvre avec son ticket
    private async showNewPayment(customerId: number) {
        try {
            const { rows } = await firstValueFrom(
                this.customerService.getCustomerPayments(customerId, this.paymentsLimit()),
            );
            this.payments.reload();
            if (rows.length === 0) return;

            this.selectPayment(rows[0]);
            this.justPaid.set(true);
            this.paymentsDialog().nativeElement.showModal();
        } catch {
            this.payments.reload();
        }
    }

    editCustomer() {
        const customer = this.data();
        if (customer) this.customerForm()?.openEdit(customer);
    }

    onSaved() {
        this.customer.reload();
        this.salesPage.set(1);
        this.sales.reload();
    }

    // Désactivation (administrateur)
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    askDelete() {
        this.deleteError.set(null);
        this.confirmDialog()?.nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog()?.nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onConfirmCancel(event: Event) {
        if (this.deleting()) event.preventDefault();
    }

    deleteCustomer() {
        const customer = this.data();
        if (!customer || this.deleting()) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.customerService
            .deleteCustomer(customer.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleting.set(false);
                    this.closeConfirm();
                    this.customer.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer le client.",
                    );
                },
            });
    }

    // Réactivation (administrateur)
    restoring = signal(false);
    restoreError = signal<string | null>(null);

    restoreCustomer() {
        const customer = this.data();
        if (!customer || this.restoring()) return;

        this.restoring.set(true);
        this.restoreError.set(null);

        this.customerService
            .restoreCustomer(customer.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoring.set(false);
                    this.customer.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoring.set(false);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de réactiver le client.",
                    );
                },
            });
    }
}

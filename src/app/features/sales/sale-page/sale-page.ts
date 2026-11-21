import { DatePipe, DecimalPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { BackState, getBackLink } from "../../../core/back-link";
import { PaymentMethod, SaleItem, SalePayment, SaleReturn } from "../../../core/sales/sale.model";
import { SaleService } from "../../../core/sales/sale.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { StockMovement } from "../../../core/stock/stock-movement.model";
import { shareReceiptImage } from "../sale-receipt/receipt-image";
import { receiptLink, ticketLinkLink } from "../sale-receipt/receipt-message";
import { SaleReceipt } from "../sale-receipt/sale-receipt";
import { MovementDetail } from "../../stock-movements/movement-detail/movement-detail";
import { PageHeader } from "../../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../../shared/action-menu/action-menu";
import { Avatar } from "../../../shared/avatar/avatar";
import { Icon } from "../../../shared/icon/icon";
import { WhatsappIcon } from "../../../shared/icon/whatsapp-icon";
import { formatInternational, toWhatsAppLink } from "../../../shared/phone";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { categoryTone, productInitials } from "../../products/product-look";

interface TimelineEvent {
    key: string;
    kind: "sale" | "payment" | "return" | "cancel";
    at: string;
    rank: number;
    payment?: SalePayment;
    ret?: SaleReturn;
    moves: StockMovement[];
}

@Component({
    selector: "app-sale-page",
    imports: [
        WhatsappIcon,
        RouterLink,
        DatePipe,
        DecimalPipe,
        PageHeader,
        Icon,
        Avatar,
        FcfaPipe,
        MovementDetail,
        SaleReceipt,
        ActionMenu,
    ],
    templateUrl: "./sale-page.html",
    styleUrls: ["./sale-page.css", "./sale-page-dialogs.css"],
})
export class SalePage {
    // pastille de l'article quand le produit n'a pas de photo
    protected initials = productInitials;
    protected tone = categoryTone;

    private saleService = inject(SaleService);
    private stockAlerts = inject(LowStockAlertService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    back = getBackLink("/sales", "Ventes");

    // la page ouverte depuis ici sait revenir sur cette vente
    private router = inject(Router);
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Vente" };
    }

    private refundDialog = viewChild.required<ElementRef<HTMLDialogElement>>("refundBox");

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // un identifiant qui n'est pas un entier n'est même pas demandé au backend
    validId = computed(() => {
        const id = this.id();
        return id !== undefined && Number.isInteger(id) && id > 0;
    });

    sale = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.saleService.getSale(params),
    });

    data = computed(() => (this.sale.hasValue() ? this.sale.value() : undefined));

    // le backend répond 404 pour une vente inexistante ou celle d'un autre employé
    notFound = computed(
        () =>
            !this.validId() || (this.sale.error() as HttpErrorResponse | undefined)?.status === 404,
    );
    errorMessage = computed(() => {
        if (this.notFound()) return "Cette vente est introuvable.";
        const err = this.sale.error() as HttpErrorResponse | undefined;
        return err?.error?.message ?? "Impossible de charger la vente.";
    });

    // total avant remises, et remises accordées sur la vente
    subtotal = computed(() =>
        (this.data()?.items ?? []).reduce(
            (sum, item) => sum + item.quantity * item.reference_price,
            0,
        ),
    );
    discounts = computed(() =>
        (this.data()?.items ?? []).reduce(
            (sum, item) => sum + item.quantity * item.discount_amount,
            0,
        ),
    );

    saleMoves = computed(() => (this.data()?.movements ?? []).filter((m) => m.type === "SALE"));

    // montant gardé par la boutique : le total moins ce qui a été rendu
    returned = computed(() => this.data()?.returned_amount ?? 0);
    net = computed(() => (this.data()?.total ?? 0) - this.returned());
    hasReturns = computed(() => this.returned() > 0 && this.data()?.status !== "CANCELLED");

    // journal : du plus récent au plus ancien, avec le stock rattaché à chaque événement
    timeline = computed<TimelineEvent[]>(() => {
        const sale = this.data();
        if (!sale) return [];

        const adjustments = sale.movements.filter((m) => m.type === "ADJUSTMENT");
        const events: TimelineEvent[] = [
            { key: "sale", kind: "sale", at: sale.created_at, rank: 0, moves: this.saleMoves() },
        ];

        for (const payment of sale.payments) {
            events.push({
                key: `payment-${payment.id}`,
                kind: "payment",
                at: payment.created_at,
                rank: 1,
                payment,
                moves: [],
            });
        }

        // chaque retour reprend son mouvement de stock (même produit et même quantité)
        for (const row of sale.returns) {
            const index = adjustments.findIndex(
                (m) => m.product_id === row.product_id && m.quantity === row.quantity,
            );
            const moves = index >= 0 ? adjustments.splice(index, 1) : [];
            events.push({
                key: `return-${row.id}`,
                kind: "return",
                at: row.created_at,
                rank: 2,
                ret: row,
                moves,
            });
        }

        if (sale.status === "CANCELLED" && sale.cancelled_at) {
            events.push({
                key: "cancel",
                kind: "cancel",
                at: sale.cancelled_at,
                rank: 3,
                moves: adjustments,
            });
        }

        return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.rank - a.rank);
    });

    // stock replié quand un événement touche plusieurs produits
    openStock = signal<string[]>([]);

    toggleStock(key: string) {
        this.openStock.update((keys) =>
            keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
        );
    }

    // détail d'un mouvement dans la même fenêtre que la page Mouvements
    private moveDetail = viewChild<MovementDetail>("moveDetail");
    selectedMove = signal<StockMovement | null>(null);

    openMove(movement: StockMovement) {
        this.selectedMove.set(movement);
        this.moveDetail()?.show();
    }

    // en-tête et message du ticket, saisis dans Paramètres
    private shopService = inject(ShopSettingsService);
    private shop = rxResource({ stream: () => this.shopService.getSettings() });
    shopInfo = computed(() => (this.shop.hasValue() ? this.shop.value() : null));

    // préfixe du numéro de ticket, choisi dans les réglages de vente
    private salesSettingsService = inject(SalesSettingsService);
    private salesSettings = rxResource({ stream: () => this.salesSettingsService.getSettings() });
    ticketPrefix = computed(() =>
        this.salesSettings.hasValue() ? this.salesSettings.value().ticket_prefix : "",
    );

    ticketNumber = computed(() =>
        formatTicketNumber(this.data()?.number ?? "", this.ticketPrefix()),
    );

    // lien WhatsApp du reçu en texte, prêt dès que le nom de la boutique et le préfixe sont connus
    whatsAppReceipt = computed(() => {
        const sale = this.data();
        const shop = this.shopInfo();
        if (!sale || !shop || !this.settingsReady()) return null;
        return receiptLink(
            sale,
            shop.name,
            this.shopService.defaultCountryCode(),
            this.ticketPrefix(),
            shop.receipt_footer ?? "",
        );
    });

    // ouvre la conversation WhatsApp du client, sans message écrit
    customerWhatsApp = computed(() => {
        const phone = this.data()?.customer_phone;
        return phone ? toWhatsAppLink(phone, this.shopService.defaultCountryCode()) : null;
    });

    // menu des trois points : envoyer en texte, imprimer, et rembourser pour le propriétaire
    returnMode = signal(false);

    menuItems = computed<ActionItem[]>(() => {
        const items: ActionItem[] = [];
        const link = this.whatsAppReceipt();
        if (link) {
            items.push({ id: "text", label: "Envoyer en texte", icon: "whatsapp", href: link });
        }
        items.push({
            id: "print",
            label: "Imprimer",
            icon: "printer",
            disabled: !this.settingsReady(),
        });
        // rendre un seul article : les boutons "Rendre" n'apparaissent sur les lignes qu'à ce moment
        if (this.canReturn()) {
            items.push({
                id: "return-mode",
                label: this.returnMode() ? "Terminer les retours" : "Rendre un article",
                icon: "undo",
                separated: true,
            });
        }
        if (this.canRefund()) {
            items.push({
                id: "refund",
                label: "Rembourser",
                icon: "undo",
                danger: true,
                separated: !this.canReturn(),
                disabled: this.reloading(),
            });
        }
        return items;
    });

    onPick(id: string) {
        if (id === "print") this.print();
        else if (id === "return-mode") this.returnMode.set(!this.returnMode());
        else if (id === "refund") this.askRefund();
    }

    private captureBox = viewChild<ElementRef<HTMLElement>>("captureBox");
    sharing = signal(false);
    shareNotice = signal("");
    shareError = signal(false);

    // ouvre la conversation WhatsApp du client avec l'adresse du ticket, prête à envoyer.
    // sans réseau, l'image du ticket est copiée à la place
    async shareImage() {
        const sale = this.data();
        const shop = this.shopInfo();
        if (!sale || !shop) return;

        this.sharing.set(true);
        this.shareNotice.set("");
        this.shareError.set(false);
        try {
            const { url } = await firstValueFrom(this.saleService.getTicketLink(sale.id));
            const link = ticketLinkLink(
                sale,
                shop.name,
                this.shopService.defaultCountryCode(),
                this.ticketPrefix(),
                url,
            );
            window.open(link, "_blank", "noopener");
        } catch {
            await this.shareImageFallback();
        } finally {
            this.sharing.set(false);
        }
    }

    private async shareImageFallback() {
        // on photographie le ticket, pas le bloc qui le décale hors de l'écran
        const box = this.captureBox()?.nativeElement.firstElementChild as HTMLElement | null;
        const sale = this.data();
        if (!box || !sale) return;

        try {
            const result = await shareReceiptImage(
                box,
                `Ticket-${this.ticketNumber()}.png`,
                sale.customer_phone,
                this.shopService.defaultCountryCode(),
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

    // un ticket sans son en-tête ni son préfixe serait faux : on bloque l'impression plutôt que de l'imprimer
    settingsReady = computed(() => this.shop.hasValue() && this.salesSettings.hasValue());
    settingsFailed = computed(() => !!(this.shop.error() || this.salesSettings.error()));

    retrySettings() {
        this.shop.reload();
        this.salesSettings.reload();
    }

    // le titre de la page sert de nom au fichier quand on enregistre en PDF
    private ticketDialog = viewChild.required<ElementRef<HTMLDialogElement>>("ticketBox");

    openTicket() {
        this.ticketDialog().nativeElement.showModal();
    }

    closeTicket() {
        this.ticketDialog().nativeElement.close();
    }

    onTicketBackdrop(event: MouseEvent) {
        if (event.target === this.ticketDialog().nativeElement) this.closeTicket();
    }

    print() {
        const title = document.title;
        document.title = `Ticket-${this.ticketNumber()}`;
        window.print();
        document.title = title;
    }

    itemsCount = computed(() =>
        (this.data()?.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    );
    // pendant le rechargement, la vente affichée peut déjà être remboursée
    reloading = computed(() => this.sale.isLoading());
    canRefund = computed(() => this.auth.isAdmin() && this.data()?.status === "ACTIVE");

    // part du total déjà encaissée, pour la barre de progression
    paidPercent = computed(() => {
        const sale = this.data();
        return sale && sale.total > 0 ? Math.floor((sale.paid_amount / sale.total) * 100) : 0;
    });
    // remplit le montant avec une part du reste à payer
    // en Afrique on pense en billets, pas en pourcentages : les coupures sous le reste, puis le solde
    quickAmounts = computed(() => {
        const due = this.due();
        const notes = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
        return notes.filter((note) => note < due).slice(-3);
    });

    payQuick(amount: number) {
        this.payAmount.set(Math.max(1, amount));
    }

    customerPhone = computed(() => {
        const phone = this.data()?.customer_phone;
        return phone ? formatInternational(phone, this.shopService.defaultCountryCode()) : "";
    });

    // reste à payer d'une vente validée (acompte)
    due = computed(() => {
        const sale = this.data();
        return sale && sale.status === "ACTIVE" ? sale.total - sale.paid_amount : 0;
    });
    // ce qui sera rendu au client : la part payée en espèces sort du tiroir, le reste se rend hors caisse
    cashPaid = computed(() =>
        (this.data()?.payments ?? [])
            .filter((payment) => payment.payment_method === "CASH")
            .reduce((sum, payment) => sum + payment.amount, 0),
    );
    otherPaid = computed(() => (this.data()?.paid_amount ?? 0) - this.cashPaid());
    // plusieurs paiements ou un reste : on détaille, sinon le résumé habituel suffit
    showPayments = computed(() => (this.data()?.payments.length ?? 0) > 1 || this.due() > 0);
    canPay = computed(() => this.due() > 0);

    payDialog = viewChild.required<ElementRef<HTMLDialogElement>>("payBox");
    payMethod = signal<PaymentMethod>("CASH");
    payAmount = signal<number | null>(null);
    payReceived = signal<number | null>(null);
    paying = signal(false);
    payError = signal<string | null>(null);

    askPay() {
        this.payMethod.set("CASH");
        this.payAmount.set(this.due());
        this.payReceived.set(null);
        this.payError.set(null);
        this.payDialog().nativeElement.showModal();
    }

    closePay() {
        if (this.paying()) return;
        this.payDialog().nativeElement.close();
    }

    onPayBackdrop(event: MouseEvent) {
        if (event.target === this.payDialog().nativeElement) this.closePay();
    }

    onPayCancel(event: Event) {
        if (this.paying()) event.preventDefault();
    }

    readNumber(input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    payChange = computed(() => {
        const received = this.payReceived();
        const amount = this.payAmount();
        if (this.payMethod() !== "CASH" || received === null || amount === null) return null;
        return received - amount;
    });

    pay() {
        const amount = this.payAmount();
        if (amount === null || amount > this.due()) {
            this.payError.set(`Le montant doit être compris entre 1 et ${this.due()} F.`);
            return;
        }

        const method = this.payMethod();
        const received = this.payReceived();

        if (method === "CASH" && received !== null && received < amount) {
            this.payError.set(`Le montant reçu est inférieur à ${amount} F.`);
            return;
        }

        this.paying.set(true);
        this.payError.set(null);

        this.saleService
            .addPayment(this.id()!, {
                paymentMethod: method,
                amountPaid: amount,
                ...(method === "CASH" ? { amountReceived: received ?? amount } : {}),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.paying.set(false);
                    this.closePay();
                    this.sale.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.paying.set(false);
                    this.payError.set(
                        err.error?.message ?? "Impossible d'enregistrer le paiement.",
                    );
                },
            });
    }

    // retour partiel d'un article d'une vente soldée
    canReturn = computed(
        () => this.auth.isAdmin() && this.data()?.status === "ACTIVE" && this.due() === 0,
    );
    returnDialog = viewChild.required<ElementRef<HTMLDialogElement>>("returnBox");
    returnItem = signal<SaleItem | null>(null);
    returnQuantity = signal<number | null>(1);
    returnReason = signal("");
    returning = signal(false);
    returnError = signal<string | null>(null);

    returnable(item: SaleItem) {
        const returned = (this.data()?.returns ?? [])
            .filter((row) => row.product_id === item.product_id)
            .reduce((sum, row) => sum + row.quantity, 0);
        return item.quantity - returned;
    }

    returnAmount = computed(
        () => (this.returnItem()?.unit_price ?? 0) * (this.returnQuantity() ?? 0),
    );

    askReturn(item: SaleItem) {
        this.returnItem.set(item);
        this.returnQuantity.set(1);
        this.returnReason.set("");
        this.returnError.set(null);
        this.returnDialog().nativeElement.showModal();
    }

    closeReturn() {
        if (this.returning()) return;
        this.returnDialog().nativeElement.close();
    }

    onReturnBackdrop(event: MouseEvent) {
        if (event.target === this.returnDialog().nativeElement) this.closeReturn();
    }

    onReturnCancel(event: Event) {
        if (this.returning()) event.preventDefault();
    }

    confirmReturn() {
        const item = this.returnItem();
        const quantity = this.returnQuantity();
        const reason = this.returnReason().trim();
        if (!item) return;

        if (quantity === null || quantity > this.returnable(item)) {
            this.returnError.set(
                `La quantité doit être comprise entre 1 et ${this.returnable(item)}.`,
            );
            return;
        }
        if (!reason) {
            this.returnError.set("Le motif du retour est obligatoire.");
            return;
        }

        this.returning.set(true);
        this.returnError.set(null);

        this.saleService
            .returnItem(this.id()!, { productId: item.product_id, quantity, reason })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.returning.set(false);
                    this.closeReturn();
                    this.sale.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.returning.set(false);
                    this.returnError.set(
                        err.error?.message ?? "Impossible d'enregistrer le retour.",
                    );
                },
            });
    }

    reason = signal("");
    refunding = signal(false);
    refundError = signal<string | null>(null);

    askRefund() {
        this.reason.set("");
        this.refundError.set(null);
        this.refundDialog().nativeElement.showModal();
    }

    closeRefund() {
        if (this.refunding()) return;
        this.refundDialog().nativeElement.close();
    }

    onRefundBackdrop(event: MouseEvent) {
        if (event.target === this.refundDialog().nativeElement) {
            this.closeRefund();
        }
    }

    onRefundCancel(event: Event) {
        if (this.refunding()) event.preventDefault();
    }

    refund() {
        const reason = this.reason().trim();
        if (!reason) {
            this.refundError.set("Le motif est obligatoire.");
            return;
        }

        this.refunding.set(true);
        this.refundError.set(null);

        this.saleService
            .cancelSale(this.id()!, reason)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.refunding.set(false);
                    this.closeRefund();
                    this.sale.reload();
                    this.stockAlerts.alerts.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.refunding.set(false);
                    this.refundError.set(
                        err.error?.message ?? "Impossible de rembourser la vente.",
                    );
                },
            });
    }
}

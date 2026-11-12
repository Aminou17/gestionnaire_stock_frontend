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
import { map } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { BackState, getBackLink } from "../../../core/back-link";
import { getRoleLabel } from "../../../core/auth/role-label";
import { SaleService } from "../../../core/sales/sale.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { StockMovement } from "../../../core/stock/stock-movement.model";
import { SaleReceipt } from "../sale-receipt/sale-receipt";
import { MovementDetail } from "../../stock-movements/movement-detail/movement-detail";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-sale-page",
    imports: [
        RouterLink,
        DatePipe,
        DecimalPipe,
        PageHeader,
        Icon,
        FcfaPipe,
        MovementDetail,
        SaleReceipt,
    ],
    templateUrl: "./sale-page.html",
    styleUrl: "./sale-page.css",
})
export class SalePage {
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

    // vient de la page Nouvelle vente
    justCreated = signal(!!inject(Router).currentNavigation()?.extras.state?.["created"]);

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

    // le backend répond 404 pour une vente inexistante ou celle d'un autre gérant
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

    sellerInitials = computed(() =>
        (this.data()?.user_name ?? "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join(""),
    );

    // passer d'une vente à l'autre garde le même lien Retour
    navState(): BackState {
        return { backTo: this.router.serializeUrl(this.back.link), backLabel: this.back.label };
    }

    saleMoves = computed(() => (this.data()?.movements ?? []).filter((m) => m.type === "SALE"));
    refundMoves = computed(() =>
        (this.data()?.movements ?? []).filter((m) => m.type === "ADJUSTMENT"),
    );

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

    ticketNumber = computed(() => formatTicketNumber(this.data()?.id ?? "", this.ticketPrefix()));

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

    constructor() {
        // au retour arrière, le navigateur rejouerait l'état "vente créée" : on l'efface
        if (this.justCreated()) {
            history.replaceState({ ...history.state, created: false }, "");
        }
    }

    reason = signal("");
    refunding = signal(false);
    refundError = signal<string | null>(null);

    // Libellé du rôle du vendeur (rien si le backend ne l'a pas envoyé)
    roleLabel(role: "admin" | "manager" | null) {
        return getRoleLabel(role);
    }

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
                    this.justCreated.set(false);
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

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
import { map } from "rxjs";

import { BackState, getBackLink } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import { CustomerSale, Paged } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { formatPhone, toTelLink, toWhatsAppLink } from "../../../shared/phone";
import { productInitials } from "../../products/product-look";
import { CustomerForm } from "../customer-form/customer-form";
import { reminderLink } from "../customer-reminder";

const SALES_PAGE_SIZE = 20;

type LoadedSales = Paged<CustomerSale> & { loadedPage: number; customerId: number };

@Component({
    selector: "app-customer-page",
    imports: [RouterLink, DatePipe, PageHeader, Icon, CustomerForm, FcfaPipe],
    templateUrl: "./customer-page.html",
    styleUrl: "./customer-page.css",
})
export class CustomerPage {
    private customerService = inject(CustomerService);
    private shop = inject(ShopSettingsService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private locale = inject(LOCALE_ID);
    protected auth = inject(AuthService);

    // un client ouvert depuis une vente ou la caisse revient à cette page
    protected back = getBackLink("/customers", "Retour aux clients");

    private customerForm = viewChild(CustomerForm);
    private confirmDialog = viewChild<ElementRef<HTMLDialogElement>>("confirmBox");

    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());
    protected telLink = (phone: string) => toTelLink(phone, this.shop.defaultCountryCode());
    protected whatsAppLink = (phone: string) =>
        toWhatsAppLink(phone, this.shop.defaultCountryCode());
    protected initials = productInitials;

    // la vente ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Client" };
    }

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // un identifiant qui n'est pas un entier n'est même pas demandé au backend
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

    // la fiche peut être réutilisée pour un autre client : on repart de la page 1
    salesPage = linkedSignal({ source: () => this.id(), computation: () => 1 });

    sales = rxResource({
        params: () => (this.validId() ? { id: this.id()!, page: this.salesPage() } : undefined),
        stream: ({ params }) =>
            this.customerService.getCustomerSales(params.id, params.page, SALES_PAGE_SIZE).pipe(
                map((res): LoadedSales => ({
                    ...res,
                    loadedPage: params.page,
                    customerId: params.id,
                })),
            ),
    });

    lastSales = linkedSignal<LoadedSales | undefined, LoadedSales | undefined>({
        source: () => (this.sales.hasValue() ? this.sales.value() : undefined),
        // les ventes de l'ancien client ne servent pas de repli pour le nouveau
        computation: (next, previous) => {
            if (next) return next;

            return previous?.value?.customerId === this.id() ? previous?.value : undefined;
        },
    });

    // la page 1 remplace la liste, les suivantes s'ajoutent
    saleList = linkedSignal<LoadedSales | undefined, CustomerSale[]>({
        source: this.lastSales,
        computation: (res, previous) => {
            if (!res) return [];
            if (res.loadedPage === 1 || !previous) return res.rows;

            const known = new Set(previous.value.map((sale) => sale.id));
            return [...previous.value, ...res.rows.filter((sale) => !known.has(sale.id))];
        },
    });

    salesTotal = computed(() => this.lastSales()?.total ?? 0);
    hasMoreSales = computed(() => this.saleList().length < this.salesTotal());
    loadingMore = computed(() => this.sales.isLoading() && this.salesPage() > 1);

    // historique groupé par mois, du plus récent au plus ancien
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

    // lien WhatsApp du rappel, vide sans numéro ou sans reste à payer
    reminder = computed(() => {
        const customer = this.data();
        return customer
            ? reminderLink(customer, this.shop.shopName(), this.shop.defaultCountryCode())
            : null;
    });

    canManage = computed(() => !!this.data()?.is_active);

    // reste à payer d'une vente non annulée
    due(sale: CustomerSale) {
        return sale.status === "ACTIVE" ? Math.max(sale.total - sale.paid_amount, 0) : 0;
    }

    loadMoreSales() {
        if (this.sales.isLoading()) return;
        this.salesPage.update((page) => page + 1);
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

    // désactivation (administrateur)
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
                        err.error?.message ?? "Impossible de désactiver le client.",
                    );
                },
            });
    }

    // réactivation (administrateur)
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

import { DatePipe } from "@angular/common";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import {
    Customer,
    CustomerPage,
    CustomerSort,
    CustomerStatus,
} from "../../core/customers/customer.model";
import { CustomerService } from "../../core/customers/customer.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { formatPhone } from "../../shared/phone";
import { productInitials } from "../products/product-look";
import { CustomerForm } from "./customer-form/customer-form";
import { reminderLink } from "./customer-reminder";

const PAGE_SIZE = 20;

const SORTS: { value: CustomerSort; label: string }[] = [
    { value: "recent", label: "Récents" },
    { value: "name", label: "Nom" },
    { value: "spent", label: "Plus gros achats" },
    { value: "due", label: "Plus gros restes" },
];

type LoadedPage = CustomerPage & { loadedPage: number };

@Component({
    selector: "app-customers",
    imports: [PageHeader, Icon, EmptyState, CustomerForm, FcfaPipe, DatePipe, RouterLink],
    templateUrl: "./customers.html",
    styleUrl: "./customers.css",
})
export class Customers {
    private customerService = inject(CustomerService);
    private router = inject(Router);
    private shop = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    private customerForm = viewChild.required(CustomerForm);
    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    protected sorts = SORTS;
    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());
    protected initials = productInitials;

    search = signal("");
    status = signal<CustomerStatus>("active");
    unpaid = signal(false);
    sort = signal<CustomerSort>("recent");
    page = signal(1);
    filtersOpen = signal(false);

    private searchTimer?: ReturnType<typeof setTimeout>;

    customers = rxResource({
        params: () => ({
            search: this.search(),
            status: this.status(),
            unpaid: this.unpaid(),
            sort: this.sort(),
            page: this.page(),
            limit: PAGE_SIZE,
        }),
        stream: ({ params }) =>
            this.customerService
                .getCustomers(params)
                .pipe(map((res): LoadedPage => ({ ...res, loadedPage: params.page }))),
    });

    // compteurs des deux puces : ils suivent la recherche, pas les autres filtres
    totals = rxResource({
        params: () => ({ search: this.search(), status: this.status() }),
        stream: ({ params }) =>
            this.customerService
                .getCustomers({ ...params, limit: 1 })
                .pipe(map((res) => res.total)),
    });

    unpaidTotals = rxResource({
        params: () => ({ search: this.search(), status: this.status() }),
        stream: ({ params }) =>
            this.customerService
                .getCustomers({ ...params, unpaid: true, limit: 1 })
                .pipe(map((res) => res.total)),
    });

    // dernière réponse reçue : gardée pendant le chargement de la suivante
    last = linkedSignal<LoadedPage | undefined, LoadedPage | undefined>({
        source: () => (this.customers.hasValue() ? this.customers.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // la page 1 remplace la liste, les suivantes s'ajoutent sans doublon
    list = linkedSignal<LoadedPage | undefined, Customer[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.loadedPage === 1 || !previous) return res.rows;

            const known = new Set(previous.value.map((customer) => customer.id));
            return [...previous.value, ...res.rows.filter((customer) => !known.has(customer.id))];
        },
    });

    total = computed(() => this.last()?.total ?? 0);
    dueTotal = computed(() => this.last()?.due_total ?? 0);

    // lien WhatsApp de la relance, vide sans numéro
    remindLink(customer: Customer) {
        return reminderLink(customer, this.shop.shopName(), this.shop.defaultCountryCode());
    }
    firstLoad = computed(() => this.customers.isLoading() && !this.last());
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.customers.isLoading() && this.page() > 1);

    // le tri par défaut suit la puce : les plus gros restes d'abord quand on relance
    defaultSort = computed<CustomerSort>(() => (this.unpaid() ? "due" : "recent"));

    // filtres choisis dans la fenêtre (hors recherche, puces et tri par défaut), en petites puces
    activeFilters = computed(() => {
        const filters: { key: "status" | "sort"; label: string }[] = [];
        if (this.status() === "inactive") filters.push({ key: "status", label: "Désactivés" });
        if (this.sort() !== this.defaultSort()) {
            filters.push({
                key: "sort",
                label: SORTS.find((sort) => sort.value === this.sort())!.label,
            });
        }
        return filters;
    });

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

        // charge la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (
                        entry.isIntersecting &&
                        this.hasMore() &&
                        !this.customers.isLoading() &&
                        !this.customers.error()
                    ) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search.set(value);
            this.page.set(1);
        }, 300);
    }

    selectUnpaid(value: boolean) {
        // un tri choisi à la main est gardé, sinon on suit le tri par défaut de la puce
        const wasDefault = this.sort() === this.defaultSort();
        this.unpaid.set(value);
        if (wasDefault) this.sort.set(this.defaultSort());
        this.page.set(1);
    }

    selectStatus(value: CustomerStatus) {
        this.status.set(value);
        this.page.set(1);
    }

    selectSort(value: CustomerSort) {
        this.sort.set(value);
        this.page.set(1);
    }

    clearFilter(key: "status" | "sort") {
        if (key === "status") this.selectStatus("active");
        else this.selectSort(this.defaultSort());
    }

    resetFilters() {
        this.unpaid.set(false);
        this.status.set("active");
        this.sort.set("recent");
        this.page.set(1);
    }

    // la fenêtre remet tout à zéro, la puce Reste à payer garde son choix
    resetPanel() {
        this.status.set("active");
        this.sort.set(this.defaultSort());
        this.page.set(1);
    }

    newCustomer() {
        this.customerForm().openNew();
    }

    // le nouveau client s'ouvre tout de suite : on y ajoute ses ventes ou on le relance
    onSaved(customer: Customer) {
        this.router.navigate(["/customers", customer.id]);
    }
}

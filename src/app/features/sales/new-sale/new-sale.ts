import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
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
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { getBackLink } from "../../../core/back-link";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { Customer } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { PaymentMethod } from "../../../core/sales/sale.model";
import { SaleService } from "../../../core/sales/sale.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { CategoryService } from "../../../core/stock/category.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { OpenCashDialog } from "../../cash/open-cash-dialog/open-cash-dialog";
import { ReopenCashDialog } from "../../cash/reopen-cash-dialog/reopen-cash-dialog";
import { CustomerForm } from "../../customers/customer-form/customer-form";
import { categoryTone, productInitials } from "../../products/product-look";
import { PageHeader } from "../../../layout/page-header/page-header";
import { resizeAvatar } from "../../../shared/avatar/avatar-resizer";
import { Icon } from "../../../shared/icon/icon";
import { Pagination, storedPageSize } from "../../../shared/pagination/pagination";
import { formatPhone, phoneKey, splitPhone } from "../../../shared/phone";
import { PhoneField } from "../../../shared/phone-field/phone-field";
import { PhotoZoom } from "../../../shared/photo-zoom/photo-zoom";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

interface CartLine {
    product: Product;
    quantity: number;
    // prix accordé : modifiable seulement pour un produit négociable
    unitPrice: number;
}

const VIEW_KEY = "new-sale-view";

const readView = (): "list" | "grid" => {
    try {
        return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
    } catch {
        return "list";
    }
};

// Prix minimum accepté pour un produit
export const getMinPrice = (product: Product) =>
    product.pricing_mode === "NEGOTIABLE"
        ? product.sale_price - product.max_discount
        : product.sale_price;

@Component({
    selector: "app-new-sale",
    imports: [
        FormsModule,
        NgTemplateOutlet,
        PageHeader,
        Icon,
        FcfaPipe,
        OpenCashDialog,
        ReopenCashDialog,
        CustomerForm,
        PhoneField,
        PhotoZoom,
        Pagination,
    ],
    templateUrl: "./new-sale.html",
    styleUrls: ["./new-sale.css", "./new-sale-cart.css"],
    // la barre du panier en bas d'écran demande de la place sous la page
    host: {
        "[class.has-cart]": "cart().length > 0",
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown)": "onKeydown($event)",
        "(window:popstate)": "onPopState()",
    },
})
export class NewSale {
    private saleService = inject(SaleService);
    private productService = inject(ProductService);
    private categoryService = inject(CategoryService);
    private cashService = inject(CashSessionService);
    private customerService = inject(CustomerService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    private shop = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);
    protected back = getBackLink("/sales", "Ventes");
    protected initials = productInitials;
    protected resize = resizeAvatar;
    protected tone = categoryTone;
    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());

    search = signal("");
    categoryId = signal<number | null>(null);
    cart = signal<CartLine[]>([]);
    saving = signal(false);
    // photo agrandie au centre de l'écran
    zoom = signal<{ src: string; name: string } | null>(null);
    error = signal<string | null>(null);
    // ajout d'une photo depuis la liste : produit en cours d'envoi, puis message de retour
    photoBusyId = signal<number | null>(null);
    photoNotice = signal<{ kind: "success" | "error"; text: string } | null>(null);

    // produits en lignes ou en carreaux, choix mémorisé
    view = signal<"list" | "grid">(readView());
    // téléphone : le panier est une feuille qui monte du bas
    cartOpen = signal(false);
    // produits dont le champ de prix négocié est déplié
    priceOpenIds = signal<ReadonlySet<number>>(new Set());

    private host = inject<ElementRef<HTMLElement>>(ElementRef);
    private photoInput = viewChild<ElementRef<HTMLInputElement>>("photoInput");
    private searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");
    private photoTarget: Product | null = null;
    private noticeTimer?: ReturnType<typeof setTimeout>;
    private searchTimer?: ReturnType<typeof setTimeout>;

    cash = rxResource({ stream: () => this.cashService.getTodayCash() });
    // on ne bloque la vente que si on SAIT que la caisse est fermée
    cashClosed = computed(() => this.cash.hasValue() && this.cash.value()?.status !== "OPEN");

    cashClosedToday = computed(
        () => this.cash.hasValue() && this.cash.value()?.status === "CLOSED",
    );

    // la page revient à 1 quand la recherche ou la catégorie change
    page = linkedSignal({
        source: () => `${this.search()}|${this.categoryId()}`,
        computation: () => 1,
    });
    pageSize = storedPageSize("new-sale");

    products = rxResource({
        params: () => ({
            search: this.search(),
            categoryId: this.categoryId(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params.search,
                categoryId: params.categoryId,
                stockStatus: null,
                status: "active",
                page: params.page,
                limit: params.limit,
            }),
    });
    // les puces ne montrent que les catégories qui ont des produits
    categories = rxResource({ stream: () => this.categoryService.getCategories() });
    categoryChips = computed(() =>
        this.categories.hasValue()
            ? this.categories.value().filter((category) => category.product_count > 0)
            : [],
    );
    results = computed(() => (this.products.hasValue() ? this.products.value().data : []));
    // le dernier total est gardé pendant le chargement d'une autre page
    resultsTotal = linkedSignal<number | undefined, number>({
        source: () => (this.products.hasValue() ? this.products.value().total : undefined),
        computation: (total, previous) => total ?? previous?.value ?? 0,
    });

    itemsCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));
    total = computed(() =>
        this.cart().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    );
    // total au prix catalogue : l'écart avec le total est la remise accordée
    subtotal = computed(() =>
        this.cart().reduce((sum, line) => sum + line.quantity * line.product.sale_price, 0),
    );
    discount = computed(() => Math.max(0, this.subtotal() - this.total()));
    // paiement : espèces par défaut, comme au comptoir
    paymentMethod = signal<PaymentMethod>("CASH");
    amountReceived = signal<number | null>(null);

    // client facultatif, obligatoire (nom ou téléphone) pour un acompte
    showCustomer = signal(false);
    // client choisi dans les fiches : la vente part avec son id
    customer = signal<Customer | null>(null);
    // saisie libre du nom et du téléphone, sans créer de fiche
    freeEntry = signal(false);
    customerName = signal("");
    customerPhone = signal("");
    customerQuery = signal("");
    pickerOpen = signal(false);
    private customerTimer?: ReturnType<typeof setTimeout>;
    private phoneTimer?: ReturnType<typeof setTimeout>;
    // téléphone tapé en saisie libre, retenu après une pause pour ne pas chercher à chaque touche
    phoneSearch = signal("");

    // sans texte, on propose les clients les plus récents
    customerResults = rxResource({
        params: () => (this.pickerOpen() ? { search: this.customerQuery() } : undefined),
        stream: ({ params }) =>
            this.customerService.getCustomers({ search: params.search, limit: 5 }),
    });
    customerList = computed(() =>
        this.customerResults.hasValue() ? this.customerResults.value().rows : [],
    );
    // assez de chiffres après l'indicatif pour chercher une fiche
    private searchable = (phone: string) =>
        splitPhone(phone, this.shop.defaultCountryCode()).national.length >= 6;
    private phoneKey = (phone: string) => phoneKey(phone, this.shop.defaultCountryCode());
    // en saisie libre, un numéro tapé qui est celui d'une fiche la propose
    phoneResults = rxResource({
        params: () => {
            const search = this.phoneSearch();
            return this.freeEntry() && this.searchable(search) ? { search } : undefined;
        },
        stream: ({ params }) =>
            this.customerService.getCustomers({ search: params.search, limit: 5 }),
    });
    phoneMatch = computed(() => {
        const typed = this.phoneKey(this.customerPhone());
        if (!this.searchable(typed) || typed !== this.phoneKey(this.phoneSearch())) return null;
        if (!this.phoneResults.hasValue()) return null;

        return (
            this.phoneResults
                .value()
                .rows.find((row) => this.phoneKey(row.phone ?? "") === typed) ?? null
        );
    });
    // un client est identifié par sa fiche ou par un nom ou un téléphone saisi
    hasCustomer = computed(
        () =>
            this.customer() !== null ||
            !!this.customerName().trim() ||
            !!this.customerPhone().trim(),
    );
    // acompte : montant payé maintenant, vide = la vente est payée en totalité
    deposit = signal<number | null>(null);
    toPay = computed(() => this.deposit() ?? this.total());
    remaining = computed(() => Math.max(0, this.total() - this.toPay()));
    // deux modes : le premier paie le montant saisi, le second paie le reste du total
    split = signal(false);
    secondMethod = computed<PaymentMethod>(() =>
        this.paymentMethod() === "CASH" ? "MOBILE_MONEY" : "CASH",
    );
    secondAmount = computed(() => Math.max(0, this.total() - (this.deposit() ?? 0)));
    depositError = computed(() => {
        const deposit = this.deposit();
        if (deposit === null) return null;
        if (this.split()) {
            return deposit >= this.total()
                ? "La part en espèces doit être inférieure au total."
                : null;
        }
        if (deposit > this.total()) return "L'acompte dépasse le total de la vente.";
        if (deposit < this.total() && !this.hasCustomer())
            return "Indiquez le nom ou le téléphone du client pour un acompte.";
        return null;
    });

    // somme reçue trop faible : on ne valide pas
    missingAmount = computed(() => {
        const received = this.amountReceived();
        if (this.paymentMethod() !== "CASH" || received === null) return 0;
        return Math.max(0, this.toPay() - received);
    });
    change = computed(() => {
        const received = this.amountReceived();
        if (this.paymentMethod() !== "CASH" || received === null) return null;
        return received - this.toPay();
    });

    // montants ronds au-dessus de la somme due, en billets courants : 7 300 donne 7 500, 8 000, 10 000
    cashSuggestions = computed(() => {
        const due = this.toPay();
        if (due <= 0) return [];

        const rounded = [500, 1000, 5000, 10000, 20000, 50000].map(
            (step) => Math.ceil(due / step) * step,
        );
        return [...new Set([due, ...rounded])].sort((a, b) => a - b).slice(0, 4);
    });

    // somme encaissée maintenant : le total, ou l'acompte
    payNow = computed(() => (this.split() ? this.total() : this.toPay()));

    // acompte et paiement en deux modes s'excluent : l'un ou l'autre fixe la part payée maintenant
    showDeposit = signal(false);

    toggleCustomer() {
        if (this.showCustomer()) this.clearCustomer();
        this.showCustomer.update((value) => !value);
        // la liste des clients récents est visible dès l'ouverture
        this.pickerOpen.set(this.showCustomer());
    }

    private clearCustomer() {
        this.customer.set(null);
        this.freeEntry.set(false);
        this.customerName.set("");
        this.customerPhone.set("");
        this.customerQuery.set("");
        this.phoneSearch.set("");
        this.pickerOpen.set(false);
    }

    onCustomerSearch(value: string) {
        this.pickerOpen.set(true);
        clearTimeout(this.customerTimer);
        this.customerTimer = setTimeout(() => this.customerQuery.set(value.trim()), 250);
    }

    closePicker(search?: HTMLInputElement) {
        // le focus rouvre la liste : on le rend d'abord, on ferme ensuite
        search?.focus();
        this.pickerOpen.set(false);
    }

    // un clic à côté du sélecteur referme la liste
    onDocumentClick(event: Event) {
        if (!this.pickerOpen()) return;
        if ((event.target as HTMLElement).closest(".picker-zone, .add-customer")) return;

        this.pickerOpen.set(false);
    }

    onPhoneInput(value: string) {
        this.customerPhone.set(value);
        clearTimeout(this.phoneTimer);
        this.phoneTimer = setTimeout(() => this.phoneSearch.set(value.trim()), 300);
    }

    chooseCustomer(customer: Customer) {
        this.customer.set(customer);
        this.freeEntry.set(false);
        this.customerName.set("");
        this.customerPhone.set("");
        this.phoneSearch.set("");
        this.pickerOpen.set(false);
        this.customerQuery.set("");
    }

    changeCustomer() {
        this.customer.set(null);
    }

    useFreeEntry() {
        this.freeEntry.set(true);
        this.pickerOpen.set(false);
    }

    backToPicker() {
        this.freeEntry.set(false);
        this.customerName.set("");
        this.customerPhone.set("");
    }

    // ce qui a été tapé sert de départ à la fiche : un numéro va dans le téléphone
    openNewCustomer(form: CustomerForm) {
        const text = this.customerQuery();
        const isPhone = /^[0-9+\-.() ]+$/.test(text);
        form.openNew(isPhone ? { phone: text } : { name: text });
    }

    onCustomerCreated(customer: Customer) {
        this.chooseCustomer(customer);
    }

    toggleDeposit() {
        this.showDeposit.update((value) => !value);
        this.split.set(false);
        this.deposit.set(null);
        this.amountReceived.set(null);
        // sans client, personne ne pourrait réclamer le solde
        if (this.showDeposit() && !this.showCustomer()) {
            this.showCustomer.set(true);
            this.pickerOpen.set(true);
        }
    }

    toggleSplit() {
        this.split.update((value) => !value);
        this.showDeposit.set(false);
        this.deposit.set(null);
        this.amountReceived.set(null);
        // le mixte est toujours espèces puis mobile money
        if (this.split()) this.paymentMethod.set("CASH");
    }

    selectPayment(method: PaymentMethod) {
        this.paymentMethod.set(method);
        this.error.set(null);
    }

    onReceivedChange(input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        this.amountReceived.set(Number.isFinite(value) && value > 0 ? value : null);
    }

    onDepositChange(input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        this.deposit.set(Number.isFinite(value) && value > 0 ? value : null);
        this.amountReceived.set(null);
    }

    hasInvalidLine = computed(() => this.cart().some((line) => this.lineError(line)));
    canSubmit = computed(
        () =>
            this.cart().length > 0 &&
            !this.hasInvalidLine() &&
            this.cash.hasValue() &&
            !this.cashClosed() &&
            this.missingAmount() === 0 &&
            this.depositError() === null &&
            // le mixte demande la part en espèces
            !(this.split() && this.deposit() === null) &&
            !this.saving(),
    );

    constructor() {
        // un panier vidé ferme la feuille
        effect(() => {
            if (this.cart().length === 0 && this.cartOpen()) this.closeCart();
        });

        this.destroyRef.onDestroy(() => {
            clearTimeout(this.searchTimer);
            clearTimeout(this.customerTimer);
            clearTimeout(this.phoneTimer);
        });

        // arrivée depuis le bouton "Vendre" d'un produit
        const productId = Number(inject(ActivatedRoute).snapshot.queryParamMap.get("productId"));
        if (Number.isInteger(productId) && productId > 0) {
            this.productService
                .getProduct(productId)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (product) => {
                        if (!product.is_active) {
                            this.error.set("Ce produit n'est plus disponible.");
                            return;
                        }
                        if (product.theoretical_stock <= 0) {
                            this.error.set(`« ${product.name} » est en rupture de stock.`);
                            return;
                        }
                        this.addProduct(product);
                    },
                    error: () => this.error.set("Ce produit n'est plus disponible."),
                });
        }
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search.set(value), 300);
    }

    inCart(product: Product) {
        return this.cart().some((line) => line.product.id === product.id);
    }

    quantityOf(product: Product) {
        return this.cart().find((line) => line.product.id === product.id)?.quantity ?? 0;
    }

    addProduct(product: Product) {
        if (product.theoretical_stock <= 0 || this.inCart(product)) return;

        this.error.set(null);
        this.cart.update((lines) => [
            ...lines,
            { product, quantity: 1, unitPrice: product.sale_price },
        ]);
    }

    // le catalogue défile dans son cadre sur ordinateur : on remonte en haut de la nouvelle page
    resetCatalogScroll() {
        this.host.nativeElement.querySelector(".tiles, .gtiles")?.scrollTo({ top: 0 });
    }

    setView(view: "list" | "grid") {
        this.view.set(view);
        try {
            localStorage.setItem(VIEW_KEY, view);
        } catch {
            // stockage indisponible : le choix ne sera pas retenu
        }
    }

    // carreaux : un appui ajoute un exemplaire, jusqu'au stock disponible
    tapTile(product: Product) {
        const line = this.cart().find((l) => l.product.id === product.id);
        if (!line) this.addProduct(product);
        else if (line.quantity < product.theoretical_stock)
            this.setQuantity(line, line.quantity + 1);
    }

    untapTile(product: Product) {
        const line = this.cart().find((l) => l.product.id === product.id);
        if (!line) return;

        if (line.quantity > 1) this.setQuantity(line, line.quantity - 1);
        else this.removeLine(line);
    }

    selectCategory(value: string) {
        this.categoryId.set(value ? Number(value) : null);
    }

    // un second clic sur une tuile déjà ajoutée la retire du panier
    toggleProduct(product: Product) {
        const line = this.cart().find((l) => l.product.id === product.id);
        if (line) this.removeLine(line);
        else this.addProduct(product);
    }

    // la liste ne porte que la miniature : on affiche celle-ci tout de suite, puis la photo en grand
    zoomImage(product: Product) {
        if (!product.image) return;

        this.zoom.set({ src: product.image, name: product.name });
        this.productService
            .getProduct(product.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (full) => {
                    const current = this.zoom();
                    if (full.image && current?.name === product.name) {
                        this.zoom.set({ src: full.image, name: product.name });
                    }
                },
                error: () => undefined,
            });
    }

    // seul l'administrateur peut changer la photo d'un produit
    askPhoto(product: Product) {
        this.photoTarget = product;
        this.photoInput()?.nativeElement.click();
    }

    async pickPhoto(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        const product = this.photoTarget;
        input.value = "";
        if (!file || !product) return;

        this.photoBusyId.set(product.id);

        try {
            const [image, thumb] = await Promise.all([
                this.resize(file, 320, 85000),
                this.resize(file, 80, 15000),
            ]);

            this.productService.setImage(product.id, image, thumb).subscribe({
                next: () => {
                    this.photoBusyId.set(null);
                    this.showPhoto(product.id, thumb);
                    this.notify("success", "Photo ajoutée.");
                },
                error: (err: HttpErrorResponse) => {
                    this.photoBusyId.set(null);
                    this.notify("error", err.error?.message ?? "La photo n'a pas pu être envoyée.");
                },
            });
        } catch (err) {
            this.photoBusyId.set(null);
            this.notify("error", (err as Error).message);
        }
    }

    // la miniature apparaît tout de suite, sans recharger la liste ni toucher au panier
    private showPhoto(id: number, thumb: string) {
        this.products.update((page) =>
            page
                ? {
                      ...page,
                      data: page.data.map((p) => (p.id === id ? { ...p, image: thumb } : p)),
                  }
                : page,
        );
        this.cart.update((lines) =>
            lines.map((line) =>
                line.product.id === id
                    ? { ...line, product: { ...line.product, image: thumb } }
                    : line,
            ),
        );
    }

    private notify(kind: "success" | "error", text: string) {
        clearTimeout(this.noticeTimer);
        this.photoNotice.set({ kind, text });
        this.noticeTimer = setTimeout(
            () => this.photoNotice.set(null),
            kind === "success" ? 3000 : 6000,
        );
    }

    clearCart() {
        this.cart.set([]);
        this.error.set(null);
    }

    removeLine(line: CartLine) {
        this.cart.update((lines) => lines.filter((l) => l !== line));
    }

    setQuantity(line: CartLine, quantity: number) {
        this.updateLine(line, { quantity });
    }

    // Valider la quantité tapée : un entier d'au moins 1, réécrit dans le champ
    // (sinon le champ pourrait afficher 1.4 alors que la vente part avec 1)
    onQuantityChange(line: CartLine, input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        const quantity = Number.isFinite(value) && value >= 1 ? value : 1;
        input.value = String(quantity);
        this.updateLine(line, { quantity });
    }

    onPriceChange(line: CartLine, input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        const unitPrice = Number.isFinite(value) ? value : line.product.sale_price;
        input.value = String(unitPrice);
        this.updateLine(line, { unitPrice });
    }

    togglePrice(line: CartLine) {
        this.priceOpenIds.update((ids) => {
            const next = new Set(ids);
            if (!next.delete(line.product.id)) next.add(line.product.id);
            return next;
        });
    }

    isPriceOpen(line: CartLine) {
        return this.priceOpenIds().has(line.product.id) || !!this.lineError(line);
    }

    private updateLine(line: CartLine, changes: Partial<CartLine>) {
        this.error.set(null);
        this.cart.update((lines) => lines.map((l) => (l === line ? { ...l, ...changes } : l)));
    }

    minPrice(product: Product) {
        return getMinPrice(product);
    }

    lineError(line: CartLine) {
        const { product, quantity, unitPrice } = line;
        if (quantity < 1) return "Quantité minimum : 1.";
        if (quantity > product.theoretical_stock)
            return `Stock insuffisant : ${product.theoretical_stock} disponible${product.theoretical_stock > 1 ? "s" : ""}.`;
        if (unitPrice < getMinPrice(product) || unitPrice > product.sale_price)
            return "Prix hors des limites autorisées.";
        return null;
    }

    submit() {
        if (!this.canSubmit()) return;

        this.saving.set(true);
        this.error.set(null);

        const items = this.cart().map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            // le backend refuse un prix envoyé pour un produit à prix fixe
            ...(line.product.pricing_mode === "NEGOTIABLE" ? { unitPrice: line.unitPrice } : {}),
        }));

        const method = this.paymentMethod();
        const received = this.amountReceived();
        const deposit = this.deposit();
        const customerId = this.customer()?.id;
        const customerName = this.customerName().trim();
        const customerPhone = this.customerPhone().trim();
        const payment = {
            paymentMethod: method,
            // montant non saisi : le client a donné le compte juste
            ...(method === "CASH" ? { amountReceived: received ?? this.toPay() } : {}),
            ...(deposit !== null && deposit < this.total() ? { amountPaid: deposit } : {}),
            ...(this.split()
                ? {
                      secondPayment: {
                          paymentMethod: this.secondMethod(),
                          amountPaid: this.secondAmount(),
                      },
                  }
                : {}),
            ...(customerId ? { customerId } : {}),
            ...(!customerId && customerName ? { customerName } : {}),
            ...(!customerId && customerPhone ? { customerPhone } : {}),
        };

        this.saleService
            .createSale(items, payment)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (sale) => {
                    // saving reste à true : la page change juste après
                    this.stockAlerts.alerts.reload();
                    // feuille ouverte : on remplace son entrée d'historique, le retour revient à la liste
                    this.router.navigate(["/sales", sale.id], {
                        state: { created: true },
                        replaceUrl: this.cartOpen(),
                    });
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);

                    // la fiche choisie a été désactivée entre-temps : on la retire
                    if (
                        err.status === 404 &&
                        customerId &&
                        /client/i.test(err.error?.message ?? "")
                    ) {
                        this.customer.set(null);
                        this.pickerOpen.set(true);
                        this.error.set(
                            "Ce client n'existe plus ou a été désactivé. Choisissez-en un autre.",
                        );
                        return;
                    }

                    this.error.set(err.error?.message ?? "Impossible d'enregistrer la vente.");
                    // stock ou caisse ont pu changer entre-temps
                    this.products.reload();
                    this.cash.reload();
                },
            });
    }

    private reopenDialog = viewChild.required<ReopenCashDialog>("reopenCash");
    private openDialog = viewChild.required<OpenCashDialog>("openCashDialog");

    reopen() {
        const cash = this.cash.value();
        if (cash) this.reopenDialog().open(cash.id);
    }

    openCash() {
        this.openDialog().open();
    }

    // la feuille prend une entrée d'historique : le bouton retour du téléphone la ferme d'abord
    openCart() {
        if (this.cartOpen()) return;

        history.pushState({ cartSheet: true }, "");
        this.cartOpen.set(true);
    }

    closeCart() {
        if (!this.cartOpen()) return;

        if (history.state?.cartSheet) history.back();
        else this.cartOpen.set(false);
    }

    onPopState() {
        this.cartOpen.set(false);
    }

    // barre du bas : encaisse tout de suite si le panier est prêt, sinon ouvre le panier
    quickPay() {
        if (this.canSubmit()) this.submit();
        else this.openCart();
    }

    // glisser l'en-tête vers le bas ferme la feuille
    private swipeFrom = 0;

    swipeStart(event: TouchEvent) {
        this.swipeFrom = event.touches[0].clientY;
    }

    swipeEnd(event: TouchEvent) {
        if (event.changedTouches[0].clientY - this.swipeFrom > 60) this.closeCart();
    }

    focusSearch() {
        const input = this.searchInput()?.nativeElement;
        input?.focus();
        input?.select();
    }

    onKeydown(event: KeyboardEvent) {
        const target = event.target as HTMLElement;
        const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

        if (event.key === "Escape") {
            this.closeCart();
            return;
        }

        // Ctrl+K ou / : aller à la recherche
        if (
            (event.key === "k" && (event.ctrlKey || event.metaKey)) ||
            (event.key === "/" && !typing)
        ) {
            event.preventDefault();
            this.focusSearch();
            return;
        }

        // Entrée encaisse depuis le montant reçu ou hors d'un champ, jamais dans une fenêtre ouverte
        const inReceived = target.id === "received";
        if (event.key === "Enter" && (inReceived || target === document.body) && this.canSubmit()) {
            if (document.querySelector("dialog[open]")) return;

            event.preventDefault();
            this.submit();
        }
    }
}

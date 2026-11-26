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
    untracked,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { ModuleAccess } from "../../../core/modules/module-access";
import { AuthService } from "../../../core/auth/auth.service";
import { getBackLink } from "../../../core/back-link";
import { isUnreachable } from "../../../core/offline/network.interceptor";
import { NetworkService } from "../../../core/offline/network.service";
import { OfflineCatalogService } from "../../../core/offline/offline-catalog.service";
import { SaleOutboxService } from "../../../core/offline/sale-outbox.service";
import { Customer } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { PaymentMethod } from "../../../core/sales/sale.model";
import { SaleService } from "../../../core/sales/sale.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { CategoryService } from "../../../core/stock/category.service";
import { CartLine, SaleDraft } from "../../../core/sales/sale-draft";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { productInitials, productTone } from "../../products/product-look";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { formatPhone } from "../../../shared/phone";
import { PhotoZoom } from "../../../shared/photo-zoom/photo-zoom";
import { BarcodeScanner } from "../../../shared/barcode-scanner/barcode-scanner";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Tout le catalogue tient sur une seule liste : la recherche et les catégories suffisent à s'y retrouver
const CATALOG_LIMIT = 500;

const VIEW_KEY = "new-sale-view";

// null tant que la personne n'a jamais choisi : la vue dépend alors des photos du catalogue
const readView = (): "list" | "grid" | null => {
    try {
        const saved = localStorage.getItem(VIEW_KEY);
        return saved === "list" || saved === "grid" ? saved : null;
    } catch {
        return null;
    }
};

// Prix minimum accepté pour un produit
export const getMinPrice = (product: Product) =>
    product.pricing_mode === "NEGOTIABLE"
        ? product.sale_price - product.max_discount
        : product.sale_price;

@Component({
    selector: "app-new-sale",
    imports: [NgTemplateOutlet, BarcodeScanner, PageHeader, RouterLink, Icon, FcfaPipe, PhotoZoom],
    templateUrl: "./new-sale.html",
    styleUrls: ["./new-sale.css", "./new-sale-cart.css"],
    // La barre du panier en bas d'écran demande de la place sous la page
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
    private customerService = inject(CustomerService);
    private stockAlerts = inject(LowStockAlertService);
    private shop = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);
    protected access = inject(ModuleAccess);
    private network = inject(NetworkService);
    protected catalog = inject(OfflineCatalogService);
    protected outbox = inject(SaleOutboxService);

    // Sans internet, la vente continue avec le catalogue gardé sur l'appareil
    offline = computed(() => !this.network.online());
    // Dernière vente encaissée : on reste sur la caisse, la confirmation se referme seule
    done = signal<{ kind: "sent" | "queued"; total: number; id?: number } | null>(null);
    private doneTimer?: ReturnType<typeof setTimeout>;
    protected back = getBackLink("/sales", "Ventes");
    protected initials = productInitials;
    protected tone = productTone;
    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());

    search = signal("");
    categoryId = signal<number | null>(null);
    // Le panier est gardé hors de la page : il reste quand on change d'écran puis qu'on revient
    cart = inject(SaleDraft).cart;
    saving = signal(false);
    // Photo agrandie au centre de l'écran
    zoom = signal<{ src: string; name: string } | null>(null);
    error = signal<string | null>(null);
    // Message bref après un scan
    photoNotice = signal<{ kind: "success" | "error"; text: string } | null>(null);

    // Téléphone : le panier est une feuille qui monte du bas
    // produits en carreaux par défaut (photo bien visible), choix mémorisé
    view = signal<"list" | "grid">(readView() ?? "grid");
    // Sans choix mémorisé, la première liste chargée décide : des carreaux sans photo ne servent à rien
    private autoView = readView() === null;
    cartOpen = signal(false);
    // Produits dont le champ de prix négocié est déplié
    priceOpenIds = signal<ReadonlySet<number>>(new Set());

    private searchInput = viewChild<ElementRef<HTMLInputElement>>("searchInput");
    private noticeTimer?: ReturnType<typeof setTimeout>;
    private searchTimer?: ReturnType<typeof setTimeout>;

    products = rxResource({
        params: () => ({
            search: this.search(),
            categoryId: this.categoryId(),
        }),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params.search,
                categoryId: params.categoryId,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: CATALOG_LIMIT,
            }),
    });
    // Les puces ne montrent que les catégories qui ont des produits
    categories = rxResource({ stream: () => this.categoryService.getCategories() });
    categoryChips = computed(() =>
        (this.offline()
            ? this.catalog.categories()
            : this.categories.hasValue()
              ? this.categories.value()
              : []
        ).filter((category) => category.product_count > 0),
    );

    // Recherche et pages faites sur l'appareil quand le serveur ne répond pas
    private localPage = computed(() => {
        const search = this.search().trim().toLowerCase();
        const categoryId = this.categoryId();
        const category = this.catalog.categories().find((c) => c.id === categoryId)?.name;

        const found = this.catalog
            .products()
            .filter(
                (product) =>
                    (!category || product.category_name === category) &&
                    (!search ||
                        product.name.toLowerCase().includes(search) ||
                        product.barcode === this.search().trim()),
            );
        return { data: found.slice(0, CATALOG_LIMIT), total: found.length };
    });

    results = computed(() =>
        this.offline()
            ? this.localPage().data
            : this.products.hasValue()
              ? this.products.value().data
              : [],
    );
    // Le dernier total est gardé pendant le chargement d'une autre page
    resultsTotal = linkedSignal<number | undefined, number>({
        source: () =>
            this.offline()
                ? this.localPage().total
                : this.products.hasValue()
                  ? this.products.value().total
                  : undefined,
        computation: (total, previous) => total ?? previous?.value ?? 0,
    });

    itemsCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));
    total = computed(() =>
        this.cart().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    );
    // Total au prix catalogue : l'écart avec le total est la remise accordée
    subtotal = computed(() =>
        this.cart().reduce((sum, line) => sum + line.quantity * line.product.sale_price, 0),
    );
    discount = computed(() => Math.max(0, this.subtotal() - this.total()));
    // Paiement : espèces par défaut, comme au comptoir
    paymentMethod = signal<PaymentMethod>("CASH");
    amountReceived = signal<number | null>(null);

    // Client facultatif, obligatoire (nom ou téléphone) pour un acompte :
    // un seul champ, une fiche proposée pendant la frappe
    customer = signal<Customer | null>(null);
    customerText = signal("");
    // Téléphone saisi pour un paiement partiel, quand le client n'a pas encore de fiche
    customerPhoneText = signal("");
    // Client et paiement partiel se règlent dans une fenêtre, le panier n'en montre qu'un résumé
    optionsOpen = computed(
        () =>
            this.showDeposit() ||
            this.customer() !== null ||
            this.customerText() !== "" ||
            this.customerPhoneText() !== "",
    );
    private creditDialog = viewChild.required<ElementRef<HTMLDialogElement>>("creditDialog");
    // Montant reçu libre : caché derrière le bouton "Autre"
    otherOpen = signal(false);
    pickerOpen = signal(false);
    private customerTimer?: ReturnType<typeof setTimeout>;
    customerQuery = signal("");

    // Sans texte, on propose les clients les plus récents
    customerResults = rxResource({
        params: () => (this.pickerOpen() ? { search: this.customerQuery() } : undefined),
        stream: ({ params }) =>
            this.customerService.getCustomers({ search: params.search, limit: 5 }),
    });
    customerList = computed(() =>
        this.customerResults.hasValue() ? this.customerResults.value().rows : [],
    );

    // Nom et téléphone : un numéro tapé dans le champ du nom part comme téléphone si l'autre champ est vide
    private typed = computed(() => {
        const text = this.customerText().trim();
        const phone = this.customerPhoneText().trim();
        if (phone || this.showDeposit()) return { name: text, phone };
        if (!text) return { name: "", phone: "" };
        return /^[0-9+\-.() ]+$/.test(text) ? { name: "", phone: text } : { name: text, phone: "" };
    });
    hasCustomer = computed(() => this.customer() !== null || this.customerText().trim() !== "");
    // Un paiement partiel laisse une dette : il faut un client qu'on peut relancer
    canChase = computed(
        () =>
            this.customer() !== null ||
            (this.customerText().trim() !== "" && this.customerPhoneText().trim() !== ""),
    );

    onCustomerInput(value: string) {
        this.customerText.set(value);
        this.pickerOpen.set(true);
        clearTimeout(this.customerTimer);
        this.customerTimer = setTimeout(() => this.customerQuery.set(value.trim()), 250);
    }

    closePicker() {
        this.pickerOpen.set(false);
    }

    // Un clic à côté du champ referme la liste
    onDocumentClick(event: Event) {
        if (!this.pickerOpen()) return;
        if ((event.target as HTMLElement).closest(".picker-zone")) return;

        this.pickerOpen.set(false);
    }

    chooseCustomer(customer: Customer) {
        this.customer.set(customer);
        this.customerText.set("");
        this.customerPhoneText.set("");
        this.customerQuery.set("");
        this.pickerOpen.set(false);
    }

    openCredit() {
        // Sans l'accès Clients et crédits : le message d'abonnement, la vente en cours reste intacte
        if (!this.access.allows("customers")) {
            this.access.showLocked("customers");
            return;
        }

        this.creditDialog().nativeElement.showModal();
    }

    closeCredit() {
        this.creditDialog().nativeElement.close();
    }

    onCreditBackdrop(event: MouseEvent) {
        if (event.target === this.creditDialog().nativeElement) this.closeCredit();
    }

    changeCustomer() {
        this.customer.set(null);
    }

    // Paiement partiel : montant payé maintenant, vide ou 0 = toute la vente reste à crédit
    showDeposit = signal(false);
    deposit = signal<number | null>(null);
    toPay = computed(() => (this.showDeposit() ? (this.deposit() ?? 0) : this.total()));
    remaining = computed(() => Math.max(0, this.total() - this.toPay()));
    // Sans client, personne ne pourrait réclamer le reste
    needsClient = computed(() => this.toPay() < this.total() && !this.canChase());
    depositError = computed(() => {
        const deposit = this.deposit();
        if (deposit === null) return null;
        if (deposit > this.total()) return "L'acompte dépasse le total de la vente.";
        if (this.needsClient())
            return "Indiquez le nom et le téléphone du client, ou choisissez sa fiche.";
        return null;
    });

    // Somme reçue trop faible : on ne valide pas
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

    // Montants ronds au-dessus de la somme due, en billets courants : 7 300 donne 7 500, 8 000, 10 000
    cashSuggestions = computed(() => {
        const due = this.toPay();
        if (due <= 0) return [];

        const rounded = [500, 1000, 5000, 10000, 20000, 50000].map(
            (step) => Math.ceil(due / step) * step,
        );
        return [...new Set([due, ...rounded])].sort((a, b) => a - b).slice(0, 3);
    });

    // Somme encaissée maintenant : le total, ou l'acompte
    payNow = computed(() => this.toPay());

    toggleDeposit() {
        this.showDeposit.update((value) => !value);
        this.deposit.set(null);
        this.amountReceived.set(null);
        this.customerText.set("");
        this.customerPhoneText.set("");
        if (this.showDeposit()) this.pickerOpen.set(!this.customer());
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
        this.deposit.set(Number.isFinite(value) && value >= 0 ? value : null);
        this.amountReceived.set(null);
    }

    hasInvalidLine = computed(() => this.cart().some((line) => this.lineError(line)));
    canSubmit = computed(
        () =>
            this.cart().length > 0 &&
            !this.hasInvalidLine() &&
            this.missingAmount() === 0 &&
            this.depositError() === null &&
            !this.needsClient() &&
            !this.saving(),
    );
    constructor() {
        // Un panier vidé ferme la feuille
        effect(() => {
            if (this.cart().length === 0 && this.cartOpen()) this.closeCart();
        });

        // Catalogue de l'appareil : lu tout de suite, puis remis à jour quand le réseau est là
        void this.catalog.load().then(() => {
            if (!this.offline()) this.catalog.refresh().catch(() => {});
        });

        effect(() => {
            const products = this.results();
            if (!this.autoView || products.length === 0) return;
            const withPhoto = products.filter((product) => product.image).length;
            untracked(() => {
                this.autoView = false;
                this.view.set(withPhoto * 2 >= products.length ? "grid" : "list");
            });
        });

        this.destroyRef.onDestroy(() => {
            clearTimeout(this.searchTimer);
            clearTimeout(this.customerTimer);
            clearTimeout(this.doneTimer);
            clearTimeout(this.noticeTimer);
        });

        // Arrivée depuis le bouton "Vendre" d'un produit
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

    // code-barres scanné : le produit va dans le panier, ou une unité de plus s'il y est déjà
    scanning = signal(false);

    async onScanned(code: string) {
        this.scanning.set(true);
        const product = await this.findByBarcode(code);
        this.scanning.set(false);

        if (!product) {
            this.notify("error", `Aucun produit avec le code ${code}.`);
            return;
        }

        const line = this.cart().find((l) => l.product.id === product.id);
        if (line) {
            this.setQuantity(line, line.quantity + 1);
        } else if (product.theoretical_stock <= 0 && !this.offline()) {
            this.notify("error", `${product.name} est en rupture de stock.`);
            return;
        } else {
            this.addProduct(product);
        }
        this.showScanCard(product);
    }

    // La fiche du produit scanné monte en bas de l'écran, avec la quantité dans le panier
    scanCard = signal<{ name: string; price: number; image: string | null; qty: number } | null>(
        null,
    );
    private scanTimer?: ReturnType<typeof setTimeout>;

    private showScanCard(product: Product) {
        const qty = this.cart().find((l) => l.product.id === product.id)?.quantity ?? 1;
        clearTimeout(this.scanTimer);
        this.scanCard.set({
            name: product.name,
            price: product.sale_price,
            image: product.image ?? null,
            qty,
        });
        this.scanTimer = setTimeout(() => this.scanCard.set(null), 2500);
    }

    private async findByBarcode(code: string): Promise<Product | null> {
        const local = () => this.catalog.products().find((p) => p.barcode === code) ?? null;
        if (this.offline()) return local();

        try {
            const page = await firstValueFrom(
                this.productService.getProducts({
                    search: code,
                    categoryId: null,
                    stockStatus: null,
                    status: "active",
                    page: 1,
                    limit: 5,
                }),
            );
            return page.data.find((p) => p.barcode === code) ?? null;
        } catch {
            return local();
        }
    }

    addProduct(product: Product) {
        if (product.theoretical_stock <= 0 || this.inCart(product)) return;

        this.error.set(null);
        this.cart.update((lines) => [
            ...lines,
            { product, quantity: 1, unitPrice: product.sale_price },
        ]);
    }

    setView(view: "list" | "grid") {
        this.view.set(view);
        try {
            localStorage.setItem(VIEW_KEY, view);
        } catch {
            // Stockage indisponible : le choix ne sera pas retenu
        }
    }

    // Lignes : un appui ajoute le produit, un second le retire
    // carreaux et lignes : un appui ajoute un exemplaire, jusqu'au stock disponible
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

    // La liste ne porte que la miniature : on affiche celle-ci tout de suite, puis la photo en grand
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

    // Charge de la vente : produits, paiement, client
    private buildSale() {
        const customer = this.customer();
        const { name, phone } = this.typed();
        const method = this.paymentMethod();
        const toPay = this.toPay();

        const items = this.cart().map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            // Le backend refuse un prix envoyé pour un produit à prix fixe
            ...(line.product.pricing_mode === "NEGOTIABLE" ? { unitPrice: line.unitPrice } : {}),
        }));
        const payment = {
            paymentMethod: method,
            // Montant non saisi : le client a donné le compte juste
            ...(method === "CASH" && toPay > 0
                ? { amountReceived: this.amountReceived() ?? toPay }
                : {}),
            ...(toPay < this.total() ? { amountPaid: toPay } : {}),
            ...(customer ? { customerId: customer.id } : {}),
            ...(!customer && name ? { customerName: name } : {}),
            ...(!customer && phone ? { customerPhone: phone } : {}),
        };
        return { items, payment, customerId: customer?.id, customerLabel: customer?.name ?? name };
    }

    // Vente sans internet : gardée sur l'appareil avec un identifiant unique, envoyée au retour du réseau.
    // Le prix envoyé est celui affiché au client.
    async queueSale() {
        this.saving.set(true);
        this.error.set(null);

        const { items, payment, customerLabel } = this.buildSale();
        const lines = this.cart();
        const total = this.total();

        try {
            await this.outbox.add(items, payment, {
                total,
                lines: lines.map((line) => ({
                    name: line.product.name,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                })),
                customer: customerLabel || null,
                method: this.paymentMethod(),
            });

            this.showDone({ kind: "queued", total });
            this.resetSale();
        } catch {
            this.error.set("Impossible de garder la vente sur cet appareil.");
        } finally {
            this.saving.set(false);
        }
    }

    // Confirmation courte : on reste sur la caisse pour la vente suivante
    private showDone(done: { kind: "sent" | "queued"; total: number; id?: number }) {
        clearTimeout(this.doneTimer);
        this.done.set(done);
        this.doneTimer = setTimeout(
            () => this.done.set(null),
            done.kind === "sent" ? 10000 : 15000,
        );
    }

    // Panier et paiement remis à zéro pour la vente suivante
    private resetSale() {
        this.closeCart();
        this.cart.set([]);
        this.paymentMethod.set("CASH");
        this.amountReceived.set(null);
        this.deposit.set(null);
        this.showDeposit.set(false);
        this.otherOpen.set(false);
        this.customer.set(null);
        this.customerText.set("");
        this.customerPhoneText.set("");
        this.customerQuery.set("");
        this.pickerOpen.set(false);
        this.priceOpenIds.set(new Set());
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

        if (this.offline()) {
            void this.queueSale();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        const { items, payment, customerId } = this.buildSale();
        const total = this.total();

        this.saleService
            .createSale(items, payment)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (sale) => {
                    this.saving.set(false);
                    this.stockAlerts.alerts.reload();
                    this.products.reload();
                    this.showDone({ kind: "sent", total, id: sale.id });
                    this.resetSale();
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);

                    // La fiche choisie a été désactivée entre-temps : on la retire
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

                    // Le serveur ne répond pas : la vente est gardée sur l'appareil
                    if (isUnreachable(err.status)) {
                        void this.queueSale();
                        return;
                    }

                    this.error.set(err.error?.message ?? "Impossible d'enregistrer la vente.");
                    // Le stock a pu changer entre-temps
                    this.products.reload();
                },
            });
    }

    // La feuille prend une entrée d'historique : le bouton retour du téléphone la ferme d'abord
    openCart() {
        if (this.cartOpen()) return;

        history.pushState({ cartSheet: true }, "");
        this.cartOpen.set(true);
    }

    // La feuille se ferme tout de suite, puis on retire l'entrée d'historique qu'elle avait ajoutée ;
    // sans ce garde, deux appels de suite reculaient de deux pages
    closeCart() {
        if (!this.cartOpen()) return;

        this.cartOpen.set(false);
        if (history.state?.cartSheet) history.back();
    }

    onPopState() {
        this.cartOpen.set(false);
    }

    // Glisser l'en-tête vers le bas ferme la feuille
    private swipeFrom = 0;

    swipeStart(event: TouchEvent) {
        this.swipeFrom = event.touches[0].clientY;
    }

    swipeEnd(event: TouchEvent) {
        if (event.changedTouches[0].clientY - this.swipeFrom > 60) this.closeCart();
    }

    // Barre du bas : vendre tout de suite avec le paiement par défaut (espèces, compte juste)
    quickPay() {
        // Une ligne à corriger ou un champ à remplir : on montre le panier
        if (!this.canSubmit()) {
            this.openCart();
            return;
        }
        this.submit();
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

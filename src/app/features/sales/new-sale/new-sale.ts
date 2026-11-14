import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    afterNextRender,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { getBackLink } from "../../../core/back-link";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { PaymentMethod } from "../../../core/sales/sale.model";
import { SaleService } from "../../../core/sales/sale.service";
import { CategoryService } from "../../../core/stock/category.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { ReopenCashDialog } from "../../cash/reopen-cash-dialog/reopen-cash-dialog";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

interface CartLine {
    product: Product;
    quantity: number;
    // prix accordé : modifiable seulement pour un produit négociable
    unitPrice: number;
}

// Prix minimum accepté pour un produit
export const getMinPrice = (product: Product) =>
    product.pricing_mode === "NEGOTIABLE"
        ? product.sale_price - product.max_discount
        : product.sale_price;

@Component({
    selector: "app-new-sale",
    imports: [PageHeader, Icon, FcfaPipe, ReopenCashDialog],
    templateUrl: "./new-sale.html",
    styleUrls: ["./new-sale.css", "./new-sale-cart.css"],
    // la barre du panier en bas d'écran demande de la place sous la page
    host: { "[class.has-cart]": "cart().length > 0" },
})
export class NewSale {
    private saleService = inject(SaleService);
    private productService = inject(ProductService);
    private categoryService = inject(CategoryService);
    private cashService = inject(CashSessionService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);
    protected back = getBackLink("/sales", "Ventes");

    search = signal("");
    categoryId = signal<number | null>(null);
    cart = signal<CartLine[]>([]);
    saving = signal(false);
    error = signal<string | null>(null);

    private searchTimer?: ReturnType<typeof setTimeout>;

    cash = rxResource({ stream: () => this.cashService.getTodayCash() });
    // on ne bloque la vente que si on SAIT que la caisse est fermée
    cashClosed = computed(() => this.cash.hasValue() && this.cash.value()?.status !== "OPEN");

    cashClosedToday = computed(
        () => this.cash.hasValue() && this.cash.value()?.status === "CLOSED",
    );

    products = rxResource({
        params: () => ({ search: this.search(), categoryId: this.categoryId() }),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params.search,
                categoryId: params.categoryId,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 24,
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
    // on n'affiche que les 24 premiers : au-delà il faut préciser la recherche
    moreResults = computed(() =>
        this.products.hasValue() ? this.products.value().total > this.results().length : false,
    );

    itemsCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));
    total = computed(() =>
        this.cart().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    );
    // paiement : espèces par défaut, comme au comptoir
    paymentMethod = signal<PaymentMethod>("CASH");
    amountReceived = signal<number | null>(null);

    // client facultatif, obligatoire (nom ou téléphone) pour un acompte
    showCustomer = signal(false);
    customerName = signal("");
    customerPhone = signal("");
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
        if (deposit < this.total() && !this.customerName().trim() && !this.customerPhone().trim())
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

    // billets ronds au-dessus du montant à payer, comme sur les caisses : 7 300 donne 7 500, 10 000
    cashSuggestions = computed(() => {
        const total = this.toPay();
        if (total <= 0) return [];
        const rounded = [500, 5000, 10000].map((step) => Math.ceil(total / step) * step);
        return [...new Set([total, ...rounded])].sort((a, b) => a - b).slice(0, 4);
    });

    // acompte et paiement en deux modes s'excluent : l'un ou l'autre fixe la part payée maintenant
    showDeposit = signal(false);

    toggleCustomer() {
        if (this.showCustomer()) {
            this.customerName.set("");
            this.customerPhone.set("");
        }
        this.showCustomer.update((value) => !value);
    }

    toggleDeposit() {
        this.showDeposit.update((value) => !value);
        this.split.set(false);
        this.deposit.set(null);
        this.amountReceived.set(null);
        // sans client, personne ne pourrait réclamer le solde
        if (this.showDeposit()) this.showCustomer.set(true);
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

    // la barre du bas sert à rejoindre le panier : inutile quand il est déjà à l'écran
    cartInView = signal(false);

    constructor() {
        afterNextRender(() => {
            const cart = document.getElementById("cart");
            if (!cart || typeof IntersectionObserver === "undefined") return;
            const observer = new IntersectionObserver(([entry]) =>
                this.cartInView.set(entry.isIntersecting),
            );
            observer.observe(cart);
            this.destroyRef.onDestroy(() => observer.disconnect());
        });
        this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

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

    addProduct(product: Product) {
        if (product.theoretical_stock <= 0 || this.inCart(product)) return;

        this.error.set(null);
        this.cart.update((lines) => [
            ...lines,
            { product, quantity: 1, unitPrice: product.sale_price },
        ]);
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
            ...(customerName ? { customerName } : {}),
            ...(customerPhone ? { customerPhone } : {}),
        };

        this.saleService
            .createSale(items, payment)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (sale) => {
                    // saving reste à true : la page change juste après
                    this.stockAlerts.alerts.reload();
                    this.router.navigate(["/sales", sale.id], { state: { created: true } });
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible d'enregistrer la vente.");
                    // stock ou caisse ont pu changer entre-temps
                    this.products.reload();
                    this.cash.reload();
                },
            });
    }

    private reopenDialog = viewChild.required<ReopenCashDialog>("reopenCash");

    reopen() {
        const cash = this.cash.value();
        if (cash) this.reopenDialog().open(cash.id);
    }

    scrollToCart() {
        document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

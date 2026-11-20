import { HttpErrorResponse } from "@angular/common/http";
import {
    AfterViewInit,
    Component,
    DestroyRef,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { concatMap, from, tap, toArray } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { StockEntryService } from "../../../core/stock/stock-entry.service";
import { SupplierService } from "../../../core/stock/supplier.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { ScanButton } from "../../../shared/scan-button/scan-button";
import { ToastService } from "../../../shared/toast/toast.service";
import { ProductForm } from "../../products/product-form/product-form";
import { categoryTone, productInitials } from "../../products/product-look";

// une ligne de la livraison : un produit et la quantité reçue
interface EntryLine {
    product: Product;
    quantity: number;
}

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

import { BackLink, injectGoBack } from "../../../shared/back-link/back-link";
@Component({
    selector: "app-new-stock-entry",
    imports: [BackLink, PageHeader, Icon, ScanButton, ProductForm],
    templateUrl: "./new-stock-entry.html",
    styleUrl: "./new-stock-entry.css",
})
export class NewStockEntry implements AfterViewInit {
    private entryService = inject(StockEntryService);
    private productService = inject(ProductService);
    private supplierService = inject(SupplierService);
    private stockAlerts = inject(LowStockAlertService);
    private toast = inject(ToastService);
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);

    private productForm = viewChild.required(ProductForm);

    protected back = getBackLink("/stock-entries", "Entrées de stock");
    private goBack = injectGoBack();
    protected initials = productInitials;
    protected tone = categoryTone;

    // ---------- Produits reçus ----------

    lines = signal<EntryLine[]>([]);
    search = signal("");
    searchFocused = signal(false);
    private searchTimer?: ReturnType<typeof setTimeout>;

    // message après un scan sans résultat : on propose de créer le produit
    unknownCode = signal<string | null>(null);

    products = rxResource({
        params: () => (this.search().trim() ? this.search().trim() : undefined),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params,
                categoryId: null,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 6,
            }),
    });
    results = computed(() => (this.products.hasValue() ? this.products.value().data : []));
    showResults = computed(() => this.search().trim().length > 0);

    units = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));

    // ---------- Fournisseur ----------

    suppliers = rxResource({ stream: () => this.supplierService.getSuppliers() });
    supplierList = computed(() =>
        (this.suppliers.hasValue() ? this.suppliers.value() : []).filter((s) => s.is_active),
    );
    supplierId = signal<number | null>(null);
    supplierName = computed(
        () => this.supplierList().find((s) => s.id === this.supplierId())?.name ?? null,
    );

    addingSupplier = signal(false);
    newSupplierName = signal("");
    newSupplierPhone = signal("");
    savingSupplier = signal(false);
    supplierError = signal<string | null>(null);

    // ---------- Enregistrement ----------

    saving = signal(false);
    error = signal<string | null>(null);
    tried = signal(false);

    canSave = computed(() => this.lines().length > 0 && this.supplierId() !== null);

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

        // depuis la fiche d'un fournisseur : il est déjà choisi
        const supplierId = toId(this.route.snapshot.queryParamMap.get("supplierId"));
        if (supplierId) this.supplierId.set(supplierId);
    }

    ngAfterViewInit() {
        // depuis la fiche d'un produit ou les alertes : /stock-entries/new?productId=3&quantity=12
        const productId = toId(this.route.snapshot.queryParamMap.get("productId"));
        if (!productId) return;

        const quantity = toId(this.route.snapshot.queryParamMap.get("quantity")) ?? 1;
        this.addById(productId, quantity);
    }

    onSearch(value: string) {
        this.unknownCode.set(null);
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search.set(value), 250);
    }

    // un produit déjà dans la liste prend une unité de plus au lieu d'une deuxième ligne
    addProduct(product: Product, quantity = 1) {
        const lines = this.lines();
        const existing = lines.find((line) => line.product.id === product.id);

        if (existing) {
            this.lines.set(
                lines.map((line) =>
                    line === existing ? { ...line, quantity: line.quantity + quantity } : line,
                ),
            );
        } else {
            this.lines.set([...lines, { product, quantity }]);
        }

        this.error.set(null);
        this.clearSearch();
        this.suggestSupplier(product.id);
    }

    private clearSearch() {
        clearTimeout(this.searchTimer);
        this.search.set("");
        const box = document.getElementById("entry-search") as HTMLInputElement | null;
        if (box) box.value = "";
    }

    // le fournisseur habituel du premier produit est proposé
    private suggestSupplier(productId: number) {
        if (this.supplierId() !== null) return;

        this.productService
            .getProduct(productId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((detail) => {
                const id = detail.supplier_id;
                if (
                    this.supplierId() === null &&
                    id &&
                    this.supplierList().some((s) => s.id === id)
                ) {
                    this.supplierId.set(id);
                }
            });
    }

    private addById(id: number, quantity = 1) {
        this.productService
            .getProduct(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (product) => {
                    if (!product.is_active) {
                        this.error.set("Ce produit a été supprimé.");
                        return;
                    }
                    this.addProduct(product, quantity);
                },
                error: () => this.error.set("Ce produit est introuvable ou supprimé."),
            });
    }

    // code scanné : le produit qui le porte est ajouté, sinon on propose de le créer
    onScanned(code: string) {
        this.unknownCode.set(null);

        this.productService
            .getProducts({
                search: code,
                categoryId: null,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 2,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (page) => {
                    const match = page.data.find((p) => p.barcode === code) ?? page.data[0];
                    if (match) this.addProduct(match);
                    else this.unknownCode.set(code);
                },
                error: () => this.error.set("Impossible de chercher ce code."),
            });
    }

    newProduct(barcode = "") {
        this.productForm().openNew(null, barcode);
    }

    // le produit créé arrive directement dans la livraison
    onProductCreated(id: number) {
        this.unknownCode.set(null);
        this.addById(id);
    }

    setQuantity(line: EntryLine, value: string | number) {
        const quantity = Math.max(1, Math.floor(Number(value) || 1));
        this.lines.update((lines) => lines.map((l) => (l === line ? { ...l, quantity } : l)));
    }

    removeLine(line: EntryLine) {
        this.lines.update((lines) => lines.filter((l) => l !== line));
    }

    selectSupplier(value: string) {
        if (value === "new") {
            this.newSupplierName.set("");
            this.newSupplierPhone.set("");
            this.supplierError.set(null);
            this.addingSupplier.set(true);
            return;
        }
        this.supplierId.set(toId(value));
    }

    addSupplier() {
        if (this.savingSupplier()) return;

        const name = this.newSupplierName().trim();
        if (!name) {
            this.supplierError.set("Le nom est obligatoire.");
            return;
        }

        // déjà dans la liste : on le choisit au lieu de créer un doublon
        const existing = this.supplierList().find(
            (s) => s.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
            this.supplierId.set(existing.id);
            this.addingSupplier.set(false);
            return;
        }

        this.savingSupplier.set(true);
        this.supplierError.set(null);

        this.supplierService
            .createSupplier({ name, telephone: this.newSupplierPhone().trim() || null })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (supplier) => {
                    this.savingSupplier.set(false);
                    this.addingSupplier.set(false);
                    this.suppliers.update((list) => [...(list ?? []), supplier]);
                    this.supplierId.set(supplier.id);
                },
                error: (err: HttpErrorResponse) => {
                    this.savingSupplier.set(false);
                    this.supplierError.set(
                        err.error?.message ?? "Impossible de créer le fournisseur.",
                    );
                },
            });
    }

    // une entrée par produit, l'une après l'autre ; en cas d'erreur, les lignes déjà
    // enregistrées sortent de la liste pour ne pas les compter deux fois
    submit() {
        if (this.saving()) return;
        this.tried.set(true);

        const supplierId = this.supplierId();
        if (this.lines().length === 0) {
            this.error.set("Ajoutez au moins un produit reçu.");
            return;
        }
        if (supplierId === null) return;

        this.saving.set(true);
        this.error.set(null);

        const done: EntryLine[] = [];

        from(this.lines())
            .pipe(
                concatMap((line) =>
                    this.entryService
                        .createEntry({
                            productId: line.product.id,
                            supplierId,
                            quantity: line.quantity,
                        })
                        // la ligne est comptée comme enregistrée dès la réponse
                        .pipe(tap(() => done.push(line))),
                ),
                toArray(),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.stockAlerts.alerts.reload();
                    const units = done.reduce((sum, line) => sum + line.quantity, 0);
                    this.toast.show(
                        `Entrée enregistrée : ${units} unité${units > 1 ? "s" : ""} reçue${units > 1 ? "s" : ""}`,
                    );
                    // le formulaire quitte l'historique : la touche retour ne le rouvre pas
                    this.goBack(this.back.link);
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.lines.update((lines) => lines.filter((line) => !done.includes(line)));
                    if (done.length > 0) this.stockAlerts.alerts.reload();

                    const failed = this.lines()[0]?.product.name;
                    const message = err.error?.message ?? "Impossible d'enregistrer l'entrée.";
                    this.error.set(
                        done.length > 0
                            ? `${done.length} produit${done.length > 1 ? "s" : ""} enregistré${done.length > 1 ? "s" : ""}. Arrêt sur « ${failed} » : ${message}`
                            : message,
                    );
                },
            });
    }
}

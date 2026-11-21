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
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { CategoryService } from "../../core/stock/category.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import {
    Product,
    ProductPage,
    ProductSort,
    ProductStatus,
    StockStatus,
} from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { SupplierService } from "../../core/stock/supplier.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { ExportFormat } from "../../core/export-format";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { BarcodeScanner } from "../../shared/barcode-scanner/barcode-scanner";
import { Icon } from "../../shared/icon/icon";
import { RevealToggle } from "../../shared/secret/reveal-toggle";
import { SecretValues } from "../../shared/secret/secret-values";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";
import { ExportService } from "../settings/settings-export/export.service";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { AdjustDialog } from "../stock-movements/adjust-dialog/adjust-dialog";
import { ProductForm } from "./product-form/product-form";
import { categoryTone, marginPercent, productInitials } from "./product-look";
import { ToastService } from "../../shared/toast/toast.service";

const VIEW_KEY = "products-view";

const readView = (): "list" | "grid" => {
    try {
        return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
    } catch {
        return "list";
    }
};

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const toStockStatus = (value: string | null): StockStatus | null =>
    value === "OK" || value === "LOW" || value === "OUT_OF_STOCK" ? value : null;

@Component({
    selector: "app-products",
    imports: [
        BarcodeScanner,
        NgTemplateOutlet,
        RouterLink,
        RevealToggle,
        PageHeader,
        Icon,
        FcfaPipe,
        ProductForm,
        ExportMenu,
        AdjustDialog,
        Pagination,
        ActionMenu,
    ],
    templateUrl: "./products.html",
    styleUrl: "./products.css",
    host: {
        "(document:keydown.escape)": "filtersOpen.set(false)",
    },
})
export class Products {
    private productService = inject(ProductService);
    private categoryService = inject(CategoryService);
    private supplierService = inject(SupplierService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    private exportService = inject(ExportService);
    protected auth = inject(AuthService);

    // le formulaire n'existe que pour l'admin
    private form = viewChild(ProductForm);
    private adjustDialog = viewChild(AdjustDialog);
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");

    // le menu Stock > Ajuster le stock demande d'ouvrir la fenêtre dès que la page est affichée
    private adjustAsked = signal(false);

    search = signal("");
    private route = inject(ActivatedRoute);

    // la catégorie filtrée vit dans l'URL (/products?categoryId=3) : lien partageable,
    // et le retour arrière ou le menu "Produits" remettent le bon filtre
    categoryId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("categoryId")));
    // l'état du stock vit aussi dans l'URL : la fiche catégorie y mène directement
    stockStatus = signal<StockStatus | null>(
        toStockStatus(this.route.snapshot.queryParamMap.get("stockStatus")),
    );
    // arrivée depuis la fiche d'un fournisseur : /products?supplierId=4
    supplierId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("supplierId")));
    status = signal<ProductStatus>("active");
    sort = signal<ProductSort>("default");
    page = signal(1);
    pageSize = storedPageSize("products");

    sorts: { value: ProductSort; label: string }[] = [
        { value: "default", label: "Par défaut" },
        { value: "recent", label: "Plus récents" },
        { value: "name", label: "Nom (A à Z)" },
        { value: "price_asc", label: "Prix croissant" },
        { value: "price_desc", label: "Prix décroissant" },
        { value: "stock_asc", label: "Stock le plus bas" },
        { value: "sold_desc", label: "Les plus vendus (30 jours)" },
        { value: "sold_asc", label: "Les moins vendus (30 jours)" },
    ];
    initials = productInitials;
    tone = categoryTone;
    margin = (product: Product) => marginPercent(product.sale_price, product.purchase_price);

    filtersOpen = signal(false);

    // nombre de filtres actifs, affiché sur le bouton Filtre
    filterCount = computed(
        () =>
            (this.categoryId() ? 1 : 0) +
            (this.status() !== "active" ? 1 : 0) +
            (this.sort() !== "default" ? 1 : 0),
    );

    // vue tableau ou grille sur ordinateur, le choix est gardé d'une visite à l'autre
    protected secret = inject(SecretValues);

    view = signal<"list" | "grid">(readView());
    toDelete = signal<Product | null>(null);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    private searchTimer?: ReturnType<typeof setTimeout>;

    products = rxResource({
        params: () => ({
            search: this.search(),
            categoryId: this.categoryId(),
            supplierId: this.supplierId(),
            stockStatus: this.stockStatus(),
            status: this.status(),
            sort: this.sort(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) => this.productService.getProducts(params),
    });
    categories = rxResource({ stream: () => this.categoryService.getCategories() });

    // seul l'administrateur voit les fournisseurs
    supplier = rxResource({
        params: () => (this.auth.isAdmin() ? (this.supplierId() ?? undefined) : undefined),
        stream: ({ params }) => this.supplierService.getSupplier(params),
    });
    supplierName = computed(() => (this.supplier.hasValue() ? this.supplier.value()?.name : null));

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<ProductPage | undefined, ProductPage | undefined>({
        source: () => (this.products.hasValue() ? this.products.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);

    total = computed(() => this.last()?.total ?? 0);
    // les compteurs viennent du résumé du backend, pas de la page chargée
    counters = computed(() => this.last()?.counters);
    // catégories supprimées hors du filtre, sauf celle qui est déjà choisie
    categoryList = computed(() =>
        (this.categories.hasValue() ? this.categories.value() : []).filter(
            (c) => c.is_active || c.id === this.categoryId(),
        ),
    );
    // les ventes ne s'affichent sur la carte que lorsque le tri les concerne
    soldView = computed(() => this.sort().startsWith("sold"));
    // valeur au prix d'achat : le backend ne l'envoie qu'à l'admin
    stockValue = computed(() => this.counters()?.stock_value);
    firstLoad = computed(() => this.products.isLoading() && !this.last());

    tabs = computed(() => {
        const counters = this.counters();
        return [
            {
                label: "Tous les produits",
                short: "Tous",
                value: null,
                count: counters?.total_products,
                tone: "primary",
                icon: "package",
            },
            {
                label: "En stock",
                short: "En stock",
                value: "OK",
                count: counters?.in_stock,
                tone: "success",
                icon: "check",
            },
            {
                label: "Stock faible",
                short: "Faible",
                value: "LOW",
                count: counters?.low_stock,
                tone: "warning",
                icon: "alert",
            },
            {
                label: "Rupture",
                short: "Rupture",
                value: "OUT_OF_STOCK",
                count: counters?.out_of_stock,
                tone: "danger",
                icon: "ban",
            },
        ] as const;
    });

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

        // la fenêtre n'existe qu'après le premier affichage, et seulement pour l'admin
        effect(() => {
            const dialog = this.adjustDialog();
            if (!this.adjustAsked() || !dialog) return;

            untracked(() => {
                this.adjustAsked.set(false);
                dialog.show();
                // sans ça, un rechargement rouvrirait la fenêtre
                this.router.navigate([], {
                    relativeTo: this.route,
                    queryParams: { adjust: null },
                    queryParamsHandling: "merge",
                    replaceUrl: true,
                });
            });
        });

        // Suivre la catégorie et l'état du stock de l'URL
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            // le menu Stock > Ajuster le stock arrive ici avec ?adjust=1
            if (params.get("adjust") === "1") this.adjustAsked.set(true);

            const categoryId = toId(params.get("categoryId"));
            const supplierId = toId(params.get("supplierId"));
            const stockStatus = toStockStatus(params.get("stockStatus"));
            if (
                categoryId === this.categoryId() &&
                supplierId === this.supplierId() &&
                stockStatus === this.stockStatus()
            ) {
                return;
            }
            this.categoryId.set(categoryId);
            this.supplierId.set(supplierId);
            this.stockStatus.set(stockStatus);
            this.page.set(1);
        });
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search.set(value);
            this.page.set(1);
        }, 300);
    }

    selectStock(value: StockStatus | null) {
        this.stockStatus.set(value);
        this.page.set(1);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { stockStatus: value },
            queryParamsHandling: "merge",
            replaceUrl: true,
        });
    }

    selectCategory(value: string) {
        this.categoryId.set(toId(value));
        this.page.set(1);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { categoryId: this.categoryId() },
            queryParamsHandling: "merge",
            replaceUrl: true,
        });
    }

    clearSupplier() {
        this.supplierId.set(null);
        this.page.set(1);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { supplierId: null },
            queryParamsHandling: "merge",
            replaceUrl: true,
        });
    }

    selectSort(value: string) {
        this.sort.set(value as ProductSort);
        this.page.set(1);
    }

    resetFilters() {
        this.categoryId.set(null);
        this.status.set("active");
        this.sort.set("default");
        this.page.set(1);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { categoryId: null },
            queryParamsHandling: "merge",
            replaceUrl: true,
        });
    }

    selectStatus(value: string) {
        this.status.set(value as ProductStatus);
        this.page.set(1);
    }

    openProduct(product: Product) {
        this.router.navigate(["/products", product.id]);
    }

    setView(view: "list" | "grid") {
        this.view.set(view);
        try {
            localStorage.setItem(VIEW_KEY, view);
        } catch {
            // navigation privée : le choix ne sera pas gardé
        }
    }

    // menu « ... » d'un produit : vendre seulement s'il en reste, le reste pour l'admin
    rowItems(product: Product): ActionItem[] {
        const items: ActionItem[] = [];
        if (product.theoretical_stock > 0) {
            items.push({ id: "sell", label: "Vendre", icon: "cart" });
        }
        if (this.auth.isAdmin()) {
            items.push(
                { id: "stock", label: "Ajouter du stock", icon: "stock-entry" },
                { id: "edit", label: "Modifier", icon: "edit" },
                // corriger une erreur de comptage : rare, donc après les gestes de tous les jours
                { id: "adjust", label: "Corriger la quantité", icon: "edit", separated: true },
                { id: "delete", label: "Supprimer", icon: "ban", danger: true },
            );
        }
        return items;
    }

    onRowPick(product: Product, id: string) {
        if (id === "sell") this.sellProduct(product);
        else if (id === "stock") this.addStock(product);
        else if (id === "adjust") this.adjustProduct(product);
        else if (id === "edit") this.editProduct(product);
        else if (id === "delete") this.askDelete(product);
    }

    sellProduct(product: Product) {
        this.router.navigate(["/sales/new"], { queryParams: { productId: product.id } });
    }

    addStock(product: Product) {
        this.router.navigate(["/stock-entries/new"], {
            queryParams: { productId: product.id },
            state: { backTo: "/products", backLabel: "Produits" },
        });
    }

    // message de confirmation après un ajustement du stock
    private toast = inject(ToastService);

    adjustProduct(product: Product) {
        this.adjustDialog()?.show(product);
    }

    onAdjusted(message: string) {
        this.toast.show(message);
        this.refresh();
    }

    newProduct() {
        this.form()?.openNew();
    }

    editProduct(product: Product) {
        this.form()?.openEdit(product.id);
    }

    askDelete(product: Product) {
        this.toDelete.set(product);
        this.deleteError.set(null);
        this.confirmDialog().nativeElement.showModal();
    }

    closeConfirm() {
        this.confirmDialog().nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === this.confirmDialog().nativeElement) {
            this.closeConfirm();
        }
    }

    deleteProduct() {
        const product = this.toDelete();
        if (!product) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.productService.deleteProduct(product.id).subscribe({
            next: () => {
                this.deleting.set(false);
                this.closeConfirm();
                this.refresh();
            },
            error: (err: HttpErrorResponse) => {
                this.deleting.set(false);
                this.deleteError.set(err.error?.message ?? "Impossible de supprimer le produit.");
            },
        });
    }

    refresh() {
        this.products.reload();
        this.stockAlerts.alerts.reload();
    }

    exporting = signal(false);
    exportError = signal<string | null>(null);

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(null);

        this.exportService.productsFile(format).subscribe({
            next: (file) => {
                this.exporting.set(false);
                const url = URL.createObjectURL(file);
                const link = document.createElement("a");
                link.href = url;
                link.download = `produits.${format}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url));
            },
            error: (err: HttpErrorResponse) => {
                this.exporting.set(false);
                this.exportError.set(
                    err.status === 413
                        ? "Il y a trop de produits pour un seul fichier."
                        : "Impossible d'exporter les produits.",
                );
            },
        });
    }
}

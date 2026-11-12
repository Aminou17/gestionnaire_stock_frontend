import { DatePipe, DecimalPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    AfterViewInit,
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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Product } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { StockEntry, StockEntryPage } from "../../core/stock/stock-entry.model";
import { StockEntryService } from "../../core/stock/stock-entry.service";
import { SupplierService } from "../../core/stock/supplier.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";

const PAGE_SIZE = 20;
// valeur de l'option "+ Créer un fournisseur"
const NEW_ID = -1;

type LoadedPage = StockEntryPage & { page: number };

const toId = (value: string | null) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

@Component({
    selector: "app-stock-entries",
    imports: [
        RouterLink,
        DatePipe,
        DecimalPipe,
        ReactiveFormsModule,
        PageHeader,
        PeriodFilter,
        Icon,
    ],
    templateUrl: "./stock-entries.html",
    styleUrl: "./stock-entries.css",
})
export class StockEntries implements AfterViewInit {
    private entryService = inject(StockEntryService);
    private productService = inject(ProductService);
    private supplierService = inject(SupplierService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("entryBox");

    protected newId = NEW_ID;

    // ---------- Liste ----------

    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    // arrivée depuis la fiche d'un fournisseur : /stock-entries?supplierId=4
    supplierId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("supplierId")));
    page = signal(1);

    entries = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            supplierId: this.supplierId(),
            page: this.page(),
            limit: PAGE_SIZE,
        }),
        stream: ({ params }) =>
            this.entryService
                .getEntries(params)
                .pipe(map((res) => ({ ...res, page: params.page }))),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<LoadedPage | undefined, LoadedPage | undefined>({
        source: () => (this.entries.hasValue() ? this.entries.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // entrées déjà chargées : la page 1 remplace la liste, les suivantes s'ajoutent sans doublon
    list = linkedSignal<LoadedPage | undefined, StockEntry[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.page === 1 || !previous) return res.data;

            const known = new Set(previous.value.map((entry) => entry.id));
            return [...previous.value, ...res.data.filter((entry) => !known.has(entry.id))];
        },
    });

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);
    firstLoad = computed(() => this.entries.isLoading() && !this.last());
    hasMore = computed(() => this.list().length < this.total());
    loadingMore = computed(() => this.entries.isLoading() && this.page() > 1);
    filtered = computed(() => this.range().period !== "all" || this.supplierId() !== null);

    suppliers = rxResource({ stream: () => this.supplierService.getSuppliers() });
    supplierList = computed(() =>
        (this.suppliers.hasValue() ? this.suppliers.value() : []).filter((s) => s.is_active),
    );

    // message après un enregistrement réussi
    success = signal<string | null>(null);

    // ---------- Nouvelle entrée ----------

    search = signal("");
    product = signal<Product | null>(null);
    saving = signal(false);
    formError = signal<string | null>(null);
    private searchTimer?: ReturnType<typeof setTimeout>;
    private lastSupplierId = 0;

    form = this.fb.group({
        supplierId: [0, Validators.min(1)],
        quantity: [
            null as number | null,
            [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
        ],
    });

    // petit formulaire "Créer un fournisseur", ouvert depuis la liste
    supplierForm = this.fb.group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        telephone: ["", Validators.maxLength(50)],
    });
    addingSupplier = signal(false);
    savingSupplier = signal(false);
    supplierError = signal<string | null>(null);

    // les produits ne sont cherchés que fenêtre ouverte
    private dialogOpen = signal(false);
    products = rxResource({
        params: () => (this.dialogOpen() && !this.product() ? this.search() : undefined),
        stream: ({ params }) =>
            this.productService.getProducts({
                search: params,
                categoryId: null,
                stockStatus: null,
                status: "active",
                page: 1,
                limit: 8,
            }),
    });
    results = computed(() => (this.products.hasValue() ? this.products.value().data : []));

    private quantity = signal<number | null>(null);
    stockAfter = computed(() => {
        const product = this.product();
        const quantity = this.quantity();
        if (!product || !quantity || quantity < 1) return null;
        return product.theoretical_stock + quantity;
    });

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

        // Charger la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && this.hasMore() && !this.entries.isLoading()) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });

        this.form.controls.quantity.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe((value) => this.quantity.set(value));

        // Ouvrir le petit formulaire quand on choisit "+ Créer un fournisseur"
        this.form.controls.supplierId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
            if (id !== NEW_ID) {
                this.lastSupplierId = id;
                return;
            }
            this.form.controls.supplierId.setValue(this.lastSupplierId, { emitEvent: false });
            this.supplierForm.reset();
            this.supplierError.set(null);
            this.addingSupplier.set(true);
        });

        // fournisseur de l'adresse inconnu ou supprimé : on montre toutes les entrées
        effect(() => {
            const id = this.supplierId();
            if (id === null || !this.suppliers.hasValue()) return;
            if (this.supplierList().some((s) => s.id === id)) return;

            this.supplierId.set(null);
            if (this.form.controls.supplierId.value === id) {
                this.form.controls.supplierId.setValue(0);
            }
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { supplierId: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
            });
        });
    }

    ngAfterViewInit() {
        // depuis la fiche d'un fournisseur sans livraison : fenêtre ouverte, fournisseur choisi
        if (this.route.snapshot.queryParamMap.get("new") === "1") {
            this.openNew();
            const supplierId = this.supplierId();
            if (supplierId) this.form.controls.supplierId.setValue(supplierId);
        }

        // arrivée depuis la fiche d'un produit : /stock-entries?productId=3
        const id = Number(this.route.snapshot.queryParamMap.get("productId"));
        if (Number.isInteger(id) && id > 0) {
            this.openNew();
            this.productService
                .getProduct(id)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (product) => {
                        // le backend refuserait l'entrée : on le dit tout de suite
                        if (!product.is_active) {
                            this.formError.set("Ce produit a été supprimé.");
                            return;
                        }
                        this.chooseProduct(product);
                    },
                    error: () => this.formError.set("Ce produit est introuvable ou supprimé."),
                });
        }
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectSupplier(value: string) {
        this.supplierId.set(value ? Number(value) : null);
        this.page.set(1);

        // l'adresse ne doit plus imposer l'ancien fournisseur au rechargement
        if (this.route.snapshot.queryParamMap.has("supplierId")) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { supplierId: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
            });
        }
    }

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }

    openNew() {
        this.success.set(null);
        this.product.set(null);
        this.search.set("");
        this.formError.set(null);
        this.addingSupplier.set(false);
        this.form.reset();
        this.dialogOpen.set(true);
        this.dialog().nativeElement.showModal();
    }

    closeNew() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    onDialogCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target !== this.dialog().nativeElement) return;
        if (this.product() || this.form.dirty) return;
        this.closeNew();
    }

    // La fenêtre est fermée : plus besoin de chercher des produits
    onClosed() {
        this.dialogOpen.set(false);
        // sans ça, un rechargement rouvrirait la fenêtre
        const params = this.route.snapshot.queryParamMap;
        if (params.has("productId") || params.has("new")) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { productId: null, new: null },
                queryParamsHandling: "merge",
                replaceUrl: true,
            });
        }
    }

    onSearch(value: string) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search.set(value), 300);
    }

    chooseProduct(product: Product) {
        this.product.set(product);
        this.formError.set(null);

        // la fiche du produit donne son fournisseur ; la liste de recherche ne l'a pas
        this.productService
            .getProduct(product.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((detail) => {
                const known = this.supplierList().some((s) => s.id === detail.supplier_id);
                if (known && !this.form.controls.supplierId.value) {
                    this.form.controls.supplierId.setValue(detail.supplier_id);
                }
            });
    }

    changeProduct() {
        this.product.set(null);
    }

    cancelSupplier() {
        if (this.savingSupplier()) return;
        this.addingSupplier.set(false);
    }

    addSupplier() {
        if (this.savingSupplier()) return;
        if (this.supplierForm.invalid) {
            this.supplierForm.markAllAsTouched();
            return;
        }

        const { name, telephone } = this.supplierForm.getRawValue();
        if (!name.trim()) {
            this.supplierForm.controls.name.setErrors({ required: true });
            this.supplierForm.markAllAsTouched();
            return;
        }

        // le fournisseur existe déjà dans la liste : on le choisit au lieu de créer un doublon
        const existing = this.supplierList().find(
            (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
        );
        if (existing) {
            this.addingSupplier.set(false);
            this.form.controls.supplierId.setValue(existing.id);
            return;
        }

        this.savingSupplier.set(true);
        this.supplierError.set(null);

        this.supplierService
            .createSupplier({ name: name.trim(), telephone: telephone.trim() || null })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (supplier) => {
                    this.savingSupplier.set(false);
                    this.addingSupplier.set(false);
                    if (this.suppliers.hasValue()) {
                        this.suppliers.update((list) => [...(list ?? []), supplier]);
                    } else {
                        this.suppliers.reload();
                    }
                    this.form.controls.supplierId.setValue(supplier.id);
                },
                error: (err: HttpErrorResponse) => {
                    this.savingSupplier.set(false);
                    this.supplierError.set(
                        err.error?.message ?? "Impossible de créer le fournisseur.",
                    );
                },
            });
    }

    submit() {
        if (this.saving()) return;

        const product = this.product();
        if (!product) {
            this.formError.set("Choisissez le produit reçu.");
            return;
        }
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { supplierId, quantity } = this.form.getRawValue();

        this.saving.set(true);
        this.formError.set(null);

        this.entryService
            .createEntry({ productId: product.id, supplierId, quantity: quantity! })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.closeNew();
                    this.success.set(`Entrée enregistrée : +${quantity} « ${product.name} ».`);
                    this.refresh();
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.formError.set(err.error?.message ?? "Impossible d'enregistrer l'entrée.");
                },
            });
    }

    private refresh() {
        if (this.page() === 1) {
            this.entries.reload();
        } else {
            this.page.set(1);
        }
        this.stockAlerts.alerts.reload();
    }
}

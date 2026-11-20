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

import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Product } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { StockEntry, StockEntryPage } from "../../core/stock/stock-entry.model";
import { AdjustDialog } from "../stock-movements/adjust-dialog/adjust-dialog";
import { StockEntryService } from "../../core/stock/stock-entry.service";
import { SupplierService } from "../../core/stock/supplier.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { Pagination, storedPageSize } from "../../shared/pagination/pagination";
import { PeriodFilter, PeriodRange } from "../../shared/period-filter/period-filter";
import { BackState } from "../../core/back-link";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { categoryTone, productInitials } from "../products/product-look";
import { ToastService } from "../../shared/toast/toast.service";

// valeur de l'option "+ Créer un fournisseur"
const NEW_ID = -1;

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
        ActionMenu,
        AdjustDialog,
        PhotoZoom,
        Pagination,
        EmptyState,
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

    zoomImage(event: Event, src: string, name: string) {
        // la photo ne doit pas ouvrir la fiche produit ni fermer la fenêtre
        event.preventDefault();
        event.stopPropagation();
        this.zoom.set({ src, name });
    }

    // la fiche produit ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Entrées de stock" };
    }
    private route = inject(ActivatedRoute);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("entryBox");
    private adjustDialog = viewChild.required(AdjustDialog);

    protected newId = NEW_ID;
    protected initials = productInitials;
    protected tone = categoryTone;

    // sur téléphone, la correction passe par le menu « … » de la carte
    protected cardActions: ActionItem[] = [
        { id: "correct", label: "Corriger la quantité", icon: "edit" },
    ];

    // photo agrandie au centre de la page
    protected zoom = signal<{ src: string; name: string } | null>(null);
    protected quickQuantities = [5, 10, 20, 50];

    // page d'où l'on vient (fiche produit, liste) : Annuler y ramène
    private origin = (() => {
        const state = this.router.currentNavigation()?.extras.state ?? history.state;
        return typeof state?.backTo === "string" && state.backTo.startsWith("/")
            ? (state.backTo as string)
            : null;
    })();
    private justSaved = false;

    // ---------- Liste ----------

    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    // arrivée depuis la fiche d'un fournisseur : /stock-entries?supplierId=4
    supplierId = signal<number | null>(toId(this.route.snapshot.queryParamMap.get("supplierId")));
    page = signal(1);
    pageSize = storedPageSize("entries");

    entries = rxResource({
        params: () => ({
            from: this.range().from,
            to: this.range().to,
            supplierId: this.supplierId(),
            page: this.page(),
            limit: this.pageSize(),
        }),
        stream: ({ params }) => this.entryService.getEntries(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<StockEntryPage | undefined, StockEntryPage | undefined>({
        source: () => (this.entries.hasValue() ? this.entries.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    list = computed(() => this.last()?.data ?? []);

    total = computed(() => this.last()?.total ?? 0);
    counters = computed(() => this.last()?.counters);

    // cartes du haut : une couleur et une icône par chiffre, comme les cartes de l'Accueil
    stats = computed(() => {
        const counters = this.counters();
        return [
            { label: "Entrées", value: counters?.entries, tone: "primary", icon: "stock-entry" },
            { label: "Unités reçues", value: counters?.units, tone: "success", icon: "package" },
            {
                label: "Produits approvisionnés",
                value: counters?.products,
                tone: "violet",
                icon: "tag",
            },
            { label: "Fournisseurs", value: counters?.suppliers, tone: "neutral", icon: "truck" },
        ] as const;
    });
    firstLoad = computed(() => this.entries.isLoading() && !this.last());
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

    protected quantity = signal<number | null>(null);
    stockAfter = computed(() => {
        const product = this.product();
        const quantity = this.quantity();
        if (!product || !quantity || quantity < 1) return null;
        return product.theoretical_stock + quantity;
    });

    constructor() {
        this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));

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

                        // quantité conseillée depuis la page Alertes
                        const quantity = Number(this.route.snapshot.queryParamMap.get("quantity"));
                        if (Number.isInteger(quantity) && quantity > 0) {
                            this.form.controls.quantity.setValue(quantity);
                        }
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
        this.justSaved = false;
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

        // annulé : retour à la page d'où l'on vient, pas sur la liste des entrées
        if (this.origin && !this.justSaved) {
            this.router.navigateByUrl(this.origin, { replaceUrl: true });
            return;
        }
        // sans ça, un rechargement rouvrirait la fenêtre
        const params = this.route.snapshot.queryParamMap;
        if (params.has("productId") || params.has("new") || params.has("quantity")) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { productId: null, new: null, quantity: null },
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
                const supplierId = detail.supplier_id;
                const known = this.supplierList().some((s) => s.id === supplierId);
                if (supplierId !== undefined && known && !this.form.controls.supplierId.value) {
                    this.form.controls.supplierId.setValue(supplierId);
                }
            });
    }

    // boutons moins et plus, et ajouts rapides à la quantité
    addQuantity(amount: number) {
        const control = this.form.controls.quantity;
        control.setValue(Math.max(1, (control.value ?? 0) + amount));
        control.markAsDirty();
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
                    this.justSaved = true;
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

    // message de confirmation après un ajustement du stock
    private toast = inject(ToastService);

    // erreur de saisie : la fenêtre d'ajustement s'ouvre déjà réglée pour retirer cette quantité
    correctError = signal<string | null>(null);

    correct(entry: StockEntry) {
        this.correctError.set(null);

        this.productService
            .getProduct(entry.product_id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (product) =>
                    this.adjustDialog().show(product, {
                        direction: "loss",
                        quantity: Math.min(entry.quantity, product.theoretical_stock),
                        reason: "correction",
                    }),
                error: () => this.correctError.set("Impossible d'ouvrir la correction."),
            });
    }

    onCorrected(message: string) {
        this.toast.show(message);
        this.stockAlerts.alerts.reload();
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

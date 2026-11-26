import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, output, signal, viewChild } from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Subscription, catchError, of, switchMap } from "rxjs";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";

import { CategoryService } from "../../../core/stock/category.service";
import { PricingMode } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { ModuleAccess } from "../../../core/modules/module-access";
import { SupplierService } from "../../../core/stock/supplier.service";
import { resizeAvatar, resizeThumb } from "../../../shared/avatar/avatar-resizer";
import { BarcodeScanner } from "../../../shared/barcode-scanner/barcode-scanner";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { ToastService } from "../../../shared/toast/toast.service";

const discountValidator = (group: AbstractControl): ValidationErrors | null => {
    const { pricingMode, salePrice, maxDiscount } = group.getRawValue();
    if (pricingMode !== "NEGOTIABLE") return null;
    if (maxDiscount === null) return { discountRequired: true };
    if (salePrice !== null && maxDiscount > salePrice) return { discountTooHigh: true };
    return null;
};

@Component({
    selector: "app-product-form",
    imports: [ReactiveFormsModule, Icon, FcfaPipe, BarcodeScanner],
    templateUrl: "./product-form.html",
    styleUrl: "./product-form.css",
})
export class ProductForm {
    private toast = inject(ToastService);
    private productService = inject(ProductService);
    private categoryService = inject(CategoryService);
    private supplierService = inject(SupplierService);
    protected access = inject(ModuleAccess);
    private stockSettings = inject(StockSettingsService);
    private salesSettingsService = inject(SalesSettingsService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    // Identifiant du produit enregistré : la page qui a ouvert le formulaire peut le reprendre
    saved = output<number>();

    form = this.fb.group(
        {
            name: ["", Validators.required],
            // Facultatifs : 0 veut dire aucun
            categoryId: [0],
            supplierId: [0],
            // Le backend refuse un prix d'achat à 0 à la création
            purchasePrice: [null as number | null, [Validators.required, Validators.min(1)]],
            salePrice: [null as number | null, [Validators.required, Validators.min(1)]],
            pricingMode: ["FIXED" as PricingMode],
            maxDiscount: [null as number | null, Validators.min(0)],
            // Vide = le produit suit le seuil par défaut
            minStock: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
            // Mêmes caractères que l'API : chiffres, lettres et - . _ /
            barcode: ["", [Validators.maxLength(64), Validators.pattern(/^[A-Za-z0-9._\-/ ]*$/)]],
        },
        { validators: discountValidator },
    );

    // Petit formulaire "Créer une catégorie", ouvert depuis la liste des catégories
    categoryForm = this.fb.group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        description: ["", Validators.maxLength(500)],
    });
    addingCategory = signal(false);
    savingCategory = signal(false);
    categoryError = signal<string | null>(null);

    // Petit formulaire "Créer un fournisseur", ouvert depuis la liste des fournisseurs
    supplierForm = this.fb.group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        telephone: ["", Validators.maxLength(50)],
    });
    addingSupplier = signal(false);
    savingSupplier = signal(false);
    supplierError = signal<string | null>(null);

    productId = signal<number | null>(null);

    // Photo : undefined = inchangée, null = retirée, sinon la nouvelle image et sa miniature
    photo = signal<{ image: string; thumb: string } | null | undefined>(undefined);
    currentImage = signal<string | null>(null);
    photoError = signal<string | null>(null);
    photoPreview = computed(() => {
        const photo = this.photo();
        return photo === undefined ? this.currentImage() : (photo?.image ?? null);
    });
    // Catégorie du produit modifié, gardée dans la liste même si elle est désactivée
    currentCategoryId = signal<number | null>(null);
    loading = signal(false);
    // Champs facultatifs (code-barres, photo, prix négociable, alerte) : repliés pour un premier produit
    moreOpen = signal(false);
    loadFailed = signal(false);
    saving = signal(false);
    error = signal<string | null>(null);

    // Chargement en cours du produit à modifier, annulé si on ferme ou ouvre un autre produit
    private loadSub?: Subscription;

    // Les listes ne sont chargées qu'à la première ouverture
    private wanted = signal(false);
    categories = rxResource({
        params: () => this.wanted() || undefined,
        stream: () => this.categoryService.getCategories(),
    });
    suppliers = rxResource({
        params: () => (this.wanted() && this.access.allows("purchases")) || undefined,
        stream: () => this.supplierService.getSuppliers(),
    });
    settings = rxResource({
        params: () => this.wanted() || undefined,
        stream: () => this.stockSettings.getSettings(),
    });

    salesSettings = rxResource({
        params: () => this.wanted() || undefined,
        stream: () => this.salesSettingsService.getSettings(),
    });

    activeCategories = computed(() =>
        this.categories.hasValue()
            ? this.categories
                  .value()
                  .filter((c) => c.is_active || c.id === this.currentCategoryId())
            : [],
    );
    supplierList = computed(() => (this.suppliers.hasValue() ? this.suppliers.value() : []));
    defaultThreshold = computed(() =>
        this.settings.hasValue() ? (this.settings.value()?.min_stock ?? null) : null,
    );

    private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

    openCategoryForm() {
        this.categoryForm.reset();
        this.categoryError.set(null);
        this.addingCategory.set(true);
    }

    // Sans l'accès Achats : le message d'abonnement
    showSupplierLocked() {
        this.access.showLocked("purchases");
    }

    openSupplierForm() {
        this.supplierForm.reset();
        this.supplierError.set(null);
        this.addingSupplier.set(true);
    }

    pricingMode = computed(() => this.values().pricingMode);

    // Champs obligatoires pas encore remplis
    todo = computed(() => {
        const v = this.values();
        return {
            name: !v.name?.trim(),
            purchase: !v.purchasePrice,
            sale: !v.salePrice,
            discount:
                v.pricingMode === "NEGOTIABLE" &&
                (v.maxDiscount === null || v.maxDiscount === undefined),
        };
    });

    // Marge affichée sous les prix
    margin = computed(() => {
        const { purchasePrice, salePrice } = this.values();
        if (!purchasePrice || !salePrice) return null;
        const amount = salePrice - purchasePrice;
        return { amount, percent: Math.round((amount / salePrice) * 100) };
    });

    // Fourchette dans laquelle l'employé pourra vendre
    priceRange = computed(() => {
        const { salePrice, maxDiscount } = this.values();
        if (!salePrice || maxDiscount === null || maxDiscount === undefined) return null;
        if (maxDiscount > salePrice) return null;
        return { min: salePrice - maxDiscount, max: salePrice };
    });

    // Ouvrir le formulaire vide pour un nouveau produit
    // categoryId : catégorie déjà choisie (ex. depuis la fiche d'une catégorie)
    // barcode : code déjà scanné qui ne correspond à aucun produit
    openNew(categoryId: number | null = null, barcode = "") {
        this.prepare(null);
        this.moreOpen.set(!!barcode);
        if (categoryId) this.form.controls.categoryId.setValue(categoryId);
        if (barcode) this.form.controls.barcode.setValue(barcode);
        this.dialog().nativeElement.showModal();
    }

    openEdit(id: number) {
        this.prepare(id);
        this.loading.set(true);
        this.dialog().nativeElement.showModal();

        this.loadSub = this.productService.getProduct(id).subscribe({
            next: (product) => {
                this.loading.set(false);
                this.currentCategoryId.set(product.category_id);
                this.currentImage.set(product.image ?? null);
                this.form.setValue({
                    name: product.name,
                    categoryId: product.category_id,
                    supplierId: product.supplier_id ?? 0,
                    purchasePrice: product.purchase_price ?? null,
                    salePrice: product.sale_price,
                    pricingMode: product.pricing_mode,
                    maxDiscount:
                        product.pricing_mode === "NEGOTIABLE" ? product.max_discount : null,
                    minStock: product.min_stock,
                    barcode: product.barcode ?? "",
                });
                // Ce qui est déjà renseigné se voit tout de suite
                this.moreOpen.set(
                    !!product.barcode ||
                        !!product.image ||
                        product.pricing_mode === "NEGOTIABLE" ||
                        product.min_stock !== null,
                );
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                this.loadFailed.set(true);
                this.error.set(err.error?.message ?? "Impossible de charger le produit.");
            },
        });
    }

    close() {
        this.dialog().nativeElement.close();
    }

    onClosed() {
        this.loadSub?.unsubscribe();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    cancelCategory() {
        if (this.savingCategory()) return;
        this.addingCategory.set(false);
    }

    addCategory() {
        // Entrée pendant l'envoi ne doit pas créer un doublon
        if (this.savingCategory()) return;
        if (this.categoryForm.invalid) {
            this.categoryForm.markAllAsTouched();
            return;
        }

        const name = this.categoryForm.getRawValue().name.trim();
        const description = this.categoryForm.getRawValue().description.trim() || null;
        if (!name) {
            this.categoryForm.controls.name.setErrors({ required: true });
            this.categoryForm.markAllAsTouched();
            return;
        }

        this.savingCategory.set(true);
        this.categoryError.set(null);

        this.categoryService.createCategory(name, description).subscribe({
            next: (category) => {
                this.savingCategory.set(false);
                this.addingCategory.set(false);
                // value() lève une exception si la liste est en erreur : on la recharge alors
                if (this.categories.hasValue()) {
                    this.categories.update((list) =>
                        [...(list ?? []), category].sort((a, b) => a.name.localeCompare(b.name)),
                    );
                } else {
                    this.categories.reload();
                }
                this.form.controls.categoryId.setValue(category.id);
            },
            error: (err: HttpErrorResponse) => {
                this.savingCategory.set(false);
                this.categoryError.set(err.error?.message ?? "Impossible de créer la catégorie.");
            },
        });
    }

    cancelSupplier() {
        if (this.savingSupplier()) return;
        this.addingSupplier.set(false);
    }

    addSupplier() {
        // Entrée pendant l'envoi ne doit pas créer un doublon
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

        // Le fournisseur existe déjà dans la liste : on le choisit au lieu de créer un doublon
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
            .subscribe({
                next: (supplier) => {
                    this.savingSupplier.set(false);
                    this.addingSupplier.set(false);
                    // value() lève une exception si la liste est en erreur : on la recharge alors
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
                        err.error?.message ?? "Impossible d'ajouter le fournisseur.",
                    );
                },
            });
    }

    async pickPhoto(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        this.photoError.set(null);
        try {
            const [image, thumb] = await Promise.all([
                resizeAvatar(file, 320, 85000),
                resizeThumb(file),
            ]);
            this.photo.set({ image, thumb });
        } catch (err) {
            this.photoError.set((err as Error).message);
        }
    }

    removePhoto() {
        this.photoError.set(null);
        this.photo.set(null);
    }

    setMode(mode: PricingMode) {
        this.form.controls.pricingMode.setValue(mode);

        // La remise par défaut des réglages de vente préremplit un champ encore vide
        const defaultDiscount = this.salesSettings.hasValue()
            ? this.salesSettings.value().default_max_discount
            : null;
        if (
            mode === "NEGOTIABLE" &&
            defaultDiscount !== null &&
            this.form.controls.maxDiscount.value === null
        ) {
            this.form.controls.maxDiscount.setValue(defaultDiscount);
        }
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            // Une erreur dans un champ replié : on le montre
            const { barcode, maxDiscount, minStock } = this.form.controls;
            if (barcode.invalid || maxDiscount.invalid || minStock.invalid || this.form.errors) {
                this.moreOpen.set(true);
            }
            return;
        }

        const value = this.form.getRawValue();
        const input = {
            name: value.name.trim(),
            categoryId: value.categoryId || null,
            supplierId: value.supplierId || null,
            purchasePrice: value.purchasePrice!,
            salePrice: value.salePrice!,
            pricingMode: value.pricingMode,
            maxDiscount: value.pricingMode === "NEGOTIABLE" ? value.maxDiscount! : 0,
            minStock: value.minStock,
            barcode: value.barcode.trim() || null,
        };

        this.saving.set(true);
        this.error.set(null);

        const id = this.productId();
        const request = id
            ? this.productService.updateProduct(id, input)
            : this.productService.createProduct(input);
        const photo = this.photo();
        let photoFailed = false;

        request
            .pipe(
                // La photo part après le produit, qui doit déjà exister
                switchMap((product) => {
                    this.productId.set(product.id);
                    if (photo === undefined) return of(product);

                    return this.productService
                        .setImage(product.id, photo?.image ?? null, photo?.thumb ?? null)
                        .pipe(
                            catchError(() => {
                                photoFailed = true;
                                return of(product);
                            }),
                        );
                }),
            )
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.saved.emit(this.productId()!);
                    this.toast.show(id ? "Produit enregistré" : "Produit ajouté");

                    if (photoFailed) {
                        this.error.set(
                            "Le produit est enregistré, mais la photo n'a pas pu être envoyée. Réessayez avec une autre image.",
                        );
                        return;
                    }
                    this.close();
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible d'enregistrer le produit.");
                },
            });
    }

    private prepare(id: number | null) {
        this.loadSub?.unsubscribe();
        this.productId.set(id);
        this.currentCategoryId.set(null);
        this.photo.set(undefined);
        this.currentImage.set(null);
        this.photoError.set(null);
        this.loadFailed.set(false);
        this.error.set(null);
        this.form.reset();
        this.addingSupplier.set(false);
        this.supplierError.set(null);
        this.addingCategory.set(false);
        this.categoryError.set(null);
        this.wanted.set(true);
    }
}

import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { CategoryService } from "../../../core/stock/category.service";
import { ProductService } from "../../../core/stock/product.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { RevealToggle } from "../../../shared/secret/reveal-toggle";
import { SecretValues } from "../../../shared/secret/secret-values";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { ProductForm } from "../../products/product-form/product-form";
import { categoryTone, productInitials } from "../../products/product-look";
import { BackState, getBackLink } from "../../../core/back-link";

// nombre de produits montrés directement sur la fiche
const PREVIEW_SIZE = 5;

// libellé de la dernière action du journal d'audit
const CHANGE_LABELS: Record<string, string> = {
    CATEGORY_CREATED: "Créée",
    CATEGORY_UPDATED: "Modifiée",
    CATEGORY_DEACTIVATED: "Supprimée",
    CATEGORY_RESTORED: "Restaurée",
};

@Component({
    selector: "app-category-page",
    imports: [
        RouterLink,
        DatePipe,
        ReactiveFormsModule,
        PageHeader,
        Icon,
        FcfaPipe,
        ProductForm,
        RevealToggle,
    ],
    templateUrl: "./category-page.html",
    styleUrl: "./category-page.css",
})
export class CategoryPage {
    // pastille du produit, comme dans la liste Produits
    protected initials = productInitials;
    protected tone = categoryTone;

    protected back = getBackLink("/categories", "Retour aux catégories");
    protected secret = inject(SecretValues);
    private categoryService = inject(CategoryService);
    private productService = inject(ProductService);
    private router = inject(Router);

    // la fiche produit ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Catégorie" };
    }
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    private formDialog = viewChild<ElementRef<HTMLDialogElement>>("formBox");
    private confirmDialog = viewChild<ElementRef<HTMLDialogElement>>("confirmBox");
    private nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");
    private descriptionInput = viewChild<ElementRef<HTMLTextAreaElement>>("descriptionInput");
    private productForm = viewChild(ProductForm);

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // un identifiant qui n'est pas un entier n'est même pas demandé au backend
    validId = computed(() => {
        const id = this.id();
        return id !== undefined && Number.isInteger(id) && id > 0;
    });

    category = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.categoryService.getCategory(params),
    });

    data = computed(() => (this.category.hasValue() ? this.category.value() : undefined));

    // premiers produits de la catégorie : rechargés quand leur nombre change (produit ajouté)
    products = rxResource({
        params: () => {
            const category = this.data();
            if (!category?.is_active || category.product_count === 0) return undefined;
            return { id: category.id, count: category.product_count };
        },
        stream: ({ params }) =>
            this.productService
                .getProducts({
                    search: "",
                    categoryId: params.id,
                    stockStatus: null,
                    status: "active",
                    page: 1,
                    limit: PREVIEW_SIZE,
                })
                .pipe(map((page) => page.data)),
    });

    preview = computed(() => (this.products.hasValue() ? this.products.value() : []));

    // produits à surveiller : faible ou en rupture
    stockAlerts = computed(() => {
        const category = this.data();
        return (category?.low_stock_count ?? 0) + (category?.out_of_stock_count ?? 0);
    });

    // "Modifiée", "Créée" (l'action brute si elle est inconnue)
    changeLabel = computed(() => {
        const action = this.data()?.last_change?.action;
        return action ? (CHANGE_LABELS[action] ?? action) : "";
    });

    // le backend répond 404 pour une catégorie inexistante (ou supprimée, pour l'employé)
    notFound = computed(
        () =>
            !this.validId() ||
            (this.category.error() as HttpErrorResponse | undefined)?.status === 404,
    );

    // seul l'admin modifie une catégorie, et seulement si elle n'est pas supprimée
    canManage = computed(() => this.auth.isAdmin() && !!this.data()?.is_active);

    // formulaire de modification
    saving = signal(false);
    formError = signal<string | null>(null);
    form = inject(NonNullableFormBuilder).group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        description: ["", Validators.maxLength(500)],
    });

    // suppression : le backend refuse si la catégorie contient des produits
    deleteBlocked = computed(() => (this.data()?.product_count ?? 0) > 0);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    // restauration d'une catégorie supprimée (admin)
    canRestore = computed(() => this.auth.isAdmin() && this.data()?.is_active === false);
    restoring = signal(false);
    restoreError = signal<string | null>(null);

    // Ouvrir le formulaire de modification
    // focusDescription : vrai quand on vient du lien "Ajouter une description"
    editCategory(focusDescription = false) {
        const category = this.data();
        if (!category) return;

        this.formError.set(null);
        this.form.reset({ name: category.name, description: category.description ?? "" });
        this.formDialog()?.nativeElement.showModal();
        const field = focusDescription ? this.descriptionInput() : this.nameInput();
        field?.nativeElement.focus();
    }

    closeForm() {
        if (this.saving()) return;
        this.formDialog()?.nativeElement.close();
    }

    submit() {
        const category = this.data();
        if (!category || this.saving()) return;
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const name = this.form.getRawValue().name.trim();
        const description = this.form.getRawValue().description.trim() || null;
        if (!name) {
            this.form.controls.name.setErrors({ required: true });
            this.form.markAllAsTouched();
            return;
        }

        // rien n'a changé : inutile d'appeler le backend
        if (category.name === name && category.description === description) {
            this.closeForm();
            return;
        }

        this.saving.set(true);
        this.formError.set(null);

        this.categoryService
            .updateCategory(category.id, name, description)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.closeForm();
                    this.category.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.formError.set(
                        err.error?.message ?? "Impossible d'enregistrer la catégorie.",
                    );
                },
            });
    }

    askDelete() {
        this.deleteError.set(null);
        this.confirmDialog()?.nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog()?.nativeElement.close();
    }

    deleteCategory() {
        const category = this.data();
        if (!category || this.deleting()) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.categoryService
            .deleteCategory(category.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleting.set(false);
                    this.closeConfirm();
                    this.router.navigate(["/categories"]);
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer la catégorie.",
                    );
                },
            });
    }

    showProducts() {
        const category = this.data();
        this.closeConfirm();
        if (category) {
            this.router.navigate(["/products"], { queryParams: { categoryId: category.id } });
        }
    }

    restoreCategory() {
        const category = this.data();
        if (!category || this.restoring()) return;

        this.restoring.set(true);
        this.restoreError.set(null);

        this.categoryService
            .restoreCategory(category.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoring.set(false);
                    this.category.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoring.set(false);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer la catégorie.",
                    );
                },
            });
    }

    addProduct() {
        const category = this.data();
        if (category) this.productForm()?.openNew(category.id);
    }

    onFormBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeForm();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onDialogCancel(event: Event) {
        if (this.saving() || this.deleting()) event.preventDefault();
    }
}

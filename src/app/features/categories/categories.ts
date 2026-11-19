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
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { Category } from "../../core/stock/category.model";
import { CategoryService } from "../../core/stock/category.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Pagination, clientPaging } from "../../shared/pagination/pagination";

type View = "active" | "deleted";

@Component({
    selector: "app-categories",
    imports: [ReactiveFormsModule, PageHeader, Icon, ActionMenu, Pagination, EmptyState],
    templateUrl: "./categories.html",
    styleUrl: "./categories.css",
})
export class Categories {
    private categoryService = inject(CategoryService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    protected rowActions: ActionItem[] = [
        { id: "edit", label: "Modifier", icon: "edit" },
        { id: "delete", label: "Supprimer", icon: "trash", danger: true },
    ];

    private formDialog = viewChild.required<ElementRef<HTMLDialogElement>>("formBox");
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirmBox");
    private nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");

    categories = rxResource({ stream: () => this.categoryService.getCategories() });
    all = computed(() => (this.categories.hasValue() ? this.categories.value() : []));

    search = signal("");
    view = signal<View>("active");

    activeCount = computed(() => this.all().filter((c) => c.is_active).length);
    deletedCount = computed(() => this.all().filter((c) => !c.is_active).length);

    // la liste est courte : recherche et filtre se font dans le navigateur
    list = computed(() => {
        const search = this.search().trim().toLowerCase();
        const showDeleted = this.view() === "deleted";
        return this.all().filter(
            (c) => c.is_active !== showDeleted && c.name.toLowerCase().includes(search),
        );
    });

    paging = clientPaging(
        () => this.list(),
        "categories",
        () => this.search() + this.view(),
    );

    // formulaire de création / modification
    editing = signal<Category | null>(null);
    saving = signal(false);
    formError = signal<string | null>(null);
    form = inject(NonNullableFormBuilder).group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        description: ["", Validators.maxLength(500)],
    });

    // suppression
    toDelete = signal<Category | null>(null);
    // le backend refuserait : la fenêtre l'explique au lieu de proposer "Supprimer"
    deleteBlocked = computed(() => (this.toDelete()?.product_count ?? 0) > 0);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    // restauration : une seule à la fois
    restoringId = signal<number | null>(null);
    restoreError = signal<string | null>(null);

    selectView(view: View) {
        this.view.set(view);
        this.restoreError.set(null);
    }

    openCategory(category: Category) {
        this.router.navigate(["/categories", category.id]);
    }

    onMenu(category: Category, action: string) {
        if (action === "edit") this.editCategory(category);
        if (action === "delete") this.askDelete(category);
    }

    newCategory() {
        this.openForm(null);
    }

    editCategory(category: Category) {
        this.openForm(category);
    }

    private openForm(category: Category | null) {
        this.editing.set(category);
        this.formError.set(null);
        this.form.reset({ name: category?.name ?? "", description: category?.description ?? "" });
        this.formDialog().nativeElement.showModal();
        this.nameInput()?.nativeElement.focus();
    }

    closeForm() {
        if (this.saving()) return;
        this.formDialog().nativeElement.close();
    }

    submit() {
        if (this.saving()) return;
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

        const editing = this.editing();
        // rien n'a changé : inutile d'appeler le backend
        if (editing && editing.name === name && editing.description === description) {
            this.closeForm();
            return;
        }

        this.saving.set(true);
        this.formError.set(null);

        const request = editing
            ? this.categoryService.updateCategory(editing.id, name, description)
            : this.categoryService.createCategory(name, description);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.saving.set(false);
                this.closeForm();
                // la catégorie créée doit être visible, quelle que soit la recherche en cours
                this.search.set("");
                this.view.set("active");
                this.categories.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.formError.set(err.error?.message ?? "Impossible d'enregistrer la catégorie.");
            },
        });
    }

    askDelete(category: Category) {
        this.toDelete.set(category);
        this.deleteError.set(null);
        this.confirmDialog().nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog().nativeElement.close();
    }

    onFormBackdrop(event: MouseEvent) {
        if (event.target === this.formDialog().nativeElement) this.closeForm();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === this.confirmDialog().nativeElement) this.closeConfirm();
    }

    onDialogCancel(event: Event) {
        if (this.saving() || this.deleting()) event.preventDefault();
    }

    showProducts() {
        const category = this.toDelete();
        this.closeConfirm();
        if (category) {
            this.router.navigate(["/products"], { queryParams: { categoryId: category.id } });
        }
    }

    deleteCategory() {
        const category = this.toDelete();
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
                    this.categories.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer la catégorie.",
                    );
                },
            });
    }

    restoreCategory(category: Category) {
        if (this.restoringId() !== null) return;

        this.restoringId.set(category.id);
        this.restoreError.set(null);

        this.categoryService
            .restoreCategory(category.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoringId.set(null);
                    this.categories.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoringId.set(null);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer la catégorie.",
                    );
                },
            });
    }
}

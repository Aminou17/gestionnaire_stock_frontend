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
import { Router } from "@angular/router";

import { Supplier } from "../../core/stock/supplier.model";
import { SupplierService } from "../../core/stock/supplier.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { formatPhone } from "./phone";
import { SupplierForm } from "./supplier-form/supplier-form";

type View = "active" | "deleted";

// Page réservée au propriétaire (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-suppliers",
    imports: [PageHeader, Icon, SupplierForm],
    templateUrl: "./suppliers.html",
    styleUrl: "./suppliers.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "menuFor.set(null)",
    },
})
export class Suppliers {
    private supplierService = inject(SupplierService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    private supplierForm = viewChild.required(SupplierForm);
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirmBox");

    suppliers = rxResource({ stream: () => this.supplierService.getSuppliers("all") });
    all = computed(() => (this.suppliers.hasValue() ? this.suppliers.value() : []));

    search = signal("");
    view = signal<View>("active");
    menuFor = signal<number | null>(null);

    activeCount = computed(() => this.all().filter((s) => s.is_active).length);
    deletedCount = computed(() => this.all().filter((s) => !s.is_active).length);

    // la liste est courte, on filtre dans le navigateur
    list = computed(() => {
        const search = this.search().trim().toLowerCase();
        const showDeleted = this.view() === "deleted";
        return this.all().filter(
            (s) =>
                s.is_active !== showDeleted &&
                [s.name, s.contact, s.telephone, s.email].some((text) =>
                    text?.toLowerCase().includes(search),
                ),
        );
    });

    protected formatPhone = formatPhone;

    // suppression
    toDelete = signal<Supplier | null>(null);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    restoringId = signal<number | null>(null);
    restoreError = signal<string | null>(null);

    selectView(view: View) {
        this.view.set(view);
        this.menuFor.set(null);
        this.restoreError.set(null);
    }

    openSupplier(supplier: Supplier) {
        this.router.navigate(["/suppliers", supplier.id]);
    }

    toggleMenu(id: number) {
        this.menuFor.set(this.menuFor() === id ? null : id);
    }

    onDocumentClick(event: Event) {
        if (!(event.target as HTMLElement).closest(".row-menu")) {
            this.menuFor.set(null);
        }
    }

    newSupplier() {
        this.supplierForm().openNew();
    }

    editSupplier(supplier: Supplier) {
        this.menuFor.set(null);
        this.supplierForm().openEdit(supplier);
    }

    onSaved() {
        // le fournisseur enregistré doit être visible, quelle que soit la recherche en cours
        this.search.set("");
        this.view.set("active");
        this.suppliers.reload();
    }

    askDelete(supplier: Supplier) {
        this.menuFor.set(null);
        this.toDelete.set(supplier);
        this.deleteError.set(null);
        this.confirmDialog().nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog().nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onConfirmCancel(event: Event) {
        if (this.deleting()) event.preventDefault();
    }

    deleteSupplier() {
        const supplier = this.toDelete();
        if (!supplier || this.deleting()) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.supplierService
            .deleteSupplier(supplier.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleting.set(false);
                    this.closeConfirm();
                    this.suppliers.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer le fournisseur.",
                    );
                },
            });
    }

    restoreSupplier(supplier: Supplier) {
        if (this.restoringId() !== null) return;

        this.restoringId.set(supplier.id);
        this.restoreError.set(null);

        this.supplierService
            .restoreSupplier(supplier.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoringId.set(null);
                    this.suppliers.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoringId.set(null);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer le fournisseur.",
                    );
                },
            });
    }
}

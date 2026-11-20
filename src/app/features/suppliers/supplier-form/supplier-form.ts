import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { Supplier, SupplierInput } from "../../../core/stock/supplier.model";
import { SupplierService } from "../../../core/stock/supplier.service";
import { PhoneField } from "../../../shared/phone-field/phone-field";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
    selector: "app-supplier-form",
    imports: [ReactiveFormsModule, PhoneField],
    templateUrl: "./supplier-form.html",
    styleUrl: "./supplier-form.css",
})
export class SupplierForm {
    private toast = inject(ToastService);
    private supplierService = inject(SupplierService);
    private destroyRef = inject(DestroyRef);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
    private nameInput = viewChild.required<ElementRef<HTMLInputElement>>("nameInput");

    // le fournisseur enregistré, pour que la page se mette à jour
    saved = output<Supplier>();

    editing = signal<Supplier | null>(null);
    saving = signal(false);
    formError = signal<string | null>(null);

    // mêmes tailles que les colonnes de la base
    form = inject(NonNullableFormBuilder).group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        contact: ["", Validators.maxLength(100)],
        telephone: ["", Validators.maxLength(50)],
        email: ["", [Validators.email, Validators.maxLength(100)]],
        address: ["", Validators.maxLength(500)],
    });

    openNew() {
        this.open(null);
    }

    // field : le champ qui reçoit le curseur, pour un lien Ajouter de la fiche
    openEdit(supplier: Supplier, field = "name") {
        this.open(supplier, field);
    }

    private open(supplier: Supplier | null, field = "name") {
        this.editing.set(supplier);
        this.formError.set(null);
        this.form.reset({
            name: supplier?.name ?? "",
            contact: supplier?.contact ?? "",
            telephone: supplier?.telephone ?? "",
            email: supplier?.email ?? "",
            address: supplier?.address ?? "",
        });
        const dialog = this.dialog().nativeElement;
        dialog.showModal();
        const input = dialog.querySelector<HTMLElement>(`[formControlName="${field}"]`);
        (input ?? this.nameInput().nativeElement).focus();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target !== event.currentTarget || this.form.dirty) return;
        this.close();
    }

    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    submit() {
        if (this.saving()) return;
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const input: SupplierInput = {
            name: value.name.trim(),
            contact: value.contact.trim() || null,
            telephone: value.telephone.trim() || null,
            email: value.email.trim() || null,
            address: value.address.trim() || null,
        };
        if (!input.name) {
            this.form.controls.name.setErrors({ required: true });
            this.form.markAllAsTouched();
            return;
        }

        const editing = this.editing();
        // rien n'a changé : inutile d'appeler le backend
        if (
            editing &&
            editing.name === input.name &&
            editing.contact === input.contact &&
            editing.telephone === input.telephone &&
            editing.email === input.email &&
            editing.address === input.address
        ) {
            this.close();
            return;
        }

        this.saving.set(true);
        this.formError.set(null);

        const request = editing
            ? this.supplierService.updateSupplier(editing.id, input)
            : this.supplierService.createSupplier(input);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (supplier) => {
                this.saving.set(false);
                this.close();
                this.saved.emit(supplier);
                this.toast.show(editing ? "Fournisseur enregistré" : "Fournisseur ajouté");
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.formError.set(
                    err.error?.message ?? "Impossible d'enregistrer le fournisseur.",
                );
            },
        });
    }
}

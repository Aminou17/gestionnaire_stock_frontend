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
import { Router } from "@angular/router";

import { Customer, CustomerInput, DuplicatePhone } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { Icon } from "../../../shared/icon/icon";
import { PhoneField } from "../../../shared/phone-field/phone-field";
import { normalizePhone } from "../../../shared/phone";

@Component({
    selector: "app-customer-form",
    imports: [ReactiveFormsModule, Icon, PhoneField],
    templateUrl: "./customer-form.html",
    styleUrl: "./customer-form.css",
})
export class CustomerForm {
    private customerService = inject(CustomerService);
    private router = inject(Router);
    private shop = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
    private nameInput = viewChild.required<ElementRef<HTMLInputElement>>("nameInput");

    // le client enregistré, pour que la page se mette à jour
    saved = output<Customer>();

    editing = signal<Customer | null>(null);
    saving = signal(false);
    formError = signal<string | null>(null);
    // la fiche qui porte déjà ce numéro
    duplicate = signal<DuplicatePhone | null>(null);

    // mêmes tailles que les colonnes de la base
    form = inject(NonNullableFormBuilder).group({
        name: ["", [Validators.required, Validators.maxLength(100)]],
        phone: ["", Validators.maxLength(30)],
        note: ["", Validators.maxLength(500)],
    });

    // prefill : ce que la caisse a déjà tapé dans la recherche
    openNew(prefill?: { name?: string; phone?: string }) {
        this.open(null, prefill);
    }

    openEdit(customer: Customer) {
        this.open(customer);
    }

    private open(customer: Customer | null, prefill?: { name?: string; phone?: string }) {
        this.editing.set(customer);
        this.formError.set(null);
        this.duplicate.set(null);
        this.form.reset({
            name: customer?.name ?? prefill?.name ?? "",
            phone: customer?.phone ?? this.prefillPhone(prefill?.phone),
            note: customer?.note ?? "",
        });
        this.dialog().nativeElement.showModal();
        this.nameInput().nativeElement.focus();
    }

    // le numéro tapé à la caisse passe au format international avec l'indicatif de la boutique
    private prefillPhone(phone?: string) {
        return phone ? normalizePhone(phone, this.shop.defaultCountryCode()) : "";
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

    openDuplicate(duplicate: DuplicatePhone) {
        this.close();
        this.router.navigate(["/customers", duplicate.id]);
    }

    submit() {
        if (this.saving()) return;
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const input: CustomerInput = {
            name: value.name.trim(),
            phone: value.phone.trim() || null,
            note: value.note.trim() || null,
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
            editing.phone === input.phone &&
            editing.note === input.note
        ) {
            this.close();
            return;
        }

        this.saving.set(true);
        this.formError.set(null);
        this.duplicate.set(null);

        const request = editing
            ? this.customerService.updateCustomer(editing.id, input)
            : this.customerService.createCustomer(input);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (customer) => {
                this.saving.set(false);
                this.close();
                this.saved.emit(customer);
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                if (err.status === 409 && err.error?.existing) {
                    this.duplicate.set(err.error.existing);
                }
                this.formError.set(err.error?.message ?? "Impossible d'enregistrer le client.");
            },
        });
    }
}

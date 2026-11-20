import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, output, signal, viewChild } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { ManualMovementType } from "../../../core/cash/cash.model";
import { CASH_REASONS } from "../../../core/cash/cash-reasons";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { ToastService } from "../../../shared/toast/toast.service";

const TEXTS: Record<ManualMovementType, { title: string; hint: string; button: string }> = {
    DEPOSIT: {
        title: "Ajouter de l'argent",
        hint: "Argent mis dans le tiroir en plus des ventes, par exemple de la monnaie.",
        button: "Ajouter",
    },
    EXPENSE: {
        title: "Enregistrer une dépense",
        hint: "Argent pris dans le tiroir pour payer quelque chose pour la boutique.",
        button: "Enregistrer la dépense",
    },
    WITHDRAWAL: {
        title: "Retirer de l'argent",
        hint: "Argent sorti du tiroir sans dépense, par exemple pour le mettre en sécurité.",
        button: "Retirer",
    },
};

@Component({
    selector: "app-cash-movement-dialog",
    imports: [ReactiveFormsModule, FcfaPipe],
    templateUrl: "./cash-movement-dialog.html",
    styleUrl: "../../../shared/dialog/dialog.css",
})
export class CashMovementDialog {
    private toast = inject(ToastService);
    private movements = inject(CashMovementService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    saved = output();

    form = this.fb.group({
        amount: [0, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
        category: [""],
        reason: ["", Validators.maxLength(200)],
    });

    type = signal<ManualMovementType>("DEPOSIT");
    saving = signal(false);
    error = signal<string | null>(null);

    texts = computed(() => TEXTS[this.type()]);
    reasons = computed(() => CASH_REASONS[this.type()]);

    open(type: ManualMovementType) {
        this.type.set(type);
        this.saving.set(false);
        this.form.reset();
        this.error.set(null);
        this.dialog().nativeElement.showModal();
        this.dialog().nativeElement.querySelector("input")?.select();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Échap ferme un <dialog> sans passer par close()
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    // ne rien renvoyer ici : Angular annule le clic si le gestionnaire renvoie false
    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    // seul le retrait peut se passer de précision
    reasonRequired = computed(() => this.type() !== "WITHDRAWAL");

    reasonMissing() {
        const control = this.form.controls.reason;
        return this.reasonRequired() && control.touched && !control.value.trim();
    }

    submit() {
        const { amount, category, reason } = this.form.getRawValue();

        if (this.form.invalid || (this.reasonRequired() && !reason.trim())) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        this.movements.create(this.type(), amount, category, reason.trim()).subscribe({
            next: () => {
                this.saving.set(false);
                this.close();
                this.saved.emit();
                this.toast.show("Mouvement enregistré");
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible d'enregistrer le mouvement.");
            },
        });
    }
}

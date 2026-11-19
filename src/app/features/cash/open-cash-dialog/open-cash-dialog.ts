import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, output, signal, viewChild } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashSessionService } from "../../../core/cash/cash-session.service";

@Component({
    selector: "app-open-cash-dialog",
    imports: [ReactiveFormsModule, FcfaPipe],
    templateUrl: "./open-cash-dialog.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./open-cash-dialog.css"],
})
export class OpenCashDialog {
    private cash = inject(CashSessionService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    opened = output();

    form = this.fb.group({
        openingAmount: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    });

    // fonds de départ les plus courants
    amounts = [5000, 10000, 20000];

    saving = signal(false);
    error = signal<string | null>(null);

    open() {
        this.form.reset();
        this.error.set(null);
        this.dialog().nativeElement.showModal();
        this.dialog().nativeElement.querySelector("input")?.select();
    }

    pick(amount: number) {
        this.form.controls.openingAmount.setValue(amount);
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Échap ferme un <dialog> sans passer par close()
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    // Un clic sur le fond grisé ferme le dialogue. Attention : ne rien renvoyer ici,
    // Angular annule l'événement (preventDefault) si le gestionnaire renvoie false,
    // ce qui bloquait le bouton "Ouvrir la caisse".
    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        this.cash.open(this.form.getRawValue().openingAmount).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialog().nativeElement.close();
                this.opened.emit();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible d'ouvrir la caisse.");
            },
        });
    }
}

import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, output, signal, viewChild } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { CashSessionService } from "../../../core/cash/cash-session.service";

@Component({
    selector: "app-reopen-cash-dialog",
    imports: [ReactiveFormsModule],
    templateUrl: "./reopen-cash-dialog.html",
    styleUrl: "../../../shared/dialog/dialog.css",
})
export class ReopenCashDialog {
    private cash = inject(CashSessionService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    reopened = output();

    form = this.fb.group({
        reason: ["", [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    });

    private sessionId = 0;
    saving = signal(false);
    error = signal<string | null>(null);

    open(sessionId: number) {
        this.sessionId = sessionId;
        this.form.reset();
        this.error.set(null);
        this.dialog().nativeElement.showModal();
        this.dialog().nativeElement.querySelector("textarea")?.focus();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Échap ferme un <dialog> sans passer par close()
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    submit() {
        if (this.saving()) return;
        const reason = this.form.getRawValue().reason.trim();

        if (reason.length < 5) {
            this.form.markAllAsTouched();
            this.form.controls.reason.setErrors({ minlength: true });
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        this.cash.reopen(this.sessionId, reason).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialog().nativeElement.close();
                this.reopened.emit();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible de rouvrir la caisse.");
            },
        });
    }
}

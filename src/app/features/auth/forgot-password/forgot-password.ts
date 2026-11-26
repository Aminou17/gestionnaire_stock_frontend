import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { Icon } from "../../../shared/icon/icon";

@Component({
    selector: "app-forgot-password",
    imports: [ReactiveFormsModule, RouterLink, Icon],
    templateUrl: "./forgot-password.html",
    styleUrls: ["../auth-form.css", "./forgot-password.css"],
})
export class ForgotPassword {
    private auth = inject(AuthService);
    private fb = inject(NonNullableFormBuilder);

    form = this.fb.group({
        email: ["", [Validators.required, Validators.email]],
    });

    loading = signal(false);
    error = signal<string | null>(null);
    // La réponse est la même que l'adresse ait un compte ou non
    sent = signal(false);

    hasError(code: string) {
        const control = this.form.controls.email;
        return control.touched && control.hasError(code);
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.auth.forgotPassword(this.form.getRawValue().email.trim().toLowerCase()).subscribe({
            next: () => {
                this.loading.set(false);
                this.sent.set(true);
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                if (err.status === 0 || err.status >= 502) {
                    this.error.set("Impossible de joindre le serveur. Vérifiez votre connexion.");
                } else {
                    this.error.set(err.error?.message ?? "Une erreur est survenue, réessayez.");
                }
            },
        });
    }
}

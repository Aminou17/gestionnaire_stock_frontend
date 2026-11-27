import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { Icon } from "../../../shared/icon/icon";
import { PasswordHint } from "../password-hint/password-hint";

const passwordsMatch = (group: AbstractControl): ValidationErrors | null => {
    const { newPassword, confirmPassword } = group.getRawValue();

    return newPassword === confirmPassword ? null : { mismatch: true };
};

@Component({
    selector: "app-reset-password",
    imports: [ReactiveFormsModule, RouterLink, Icon, PasswordHint],
    templateUrl: "./reset-password.html",
    styleUrl: "../auth-form.css",
})
export class ResetPassword {
    private auth = inject(AuthService);

    // Le lien reçu par e-mail : /reset-password?token
    private token = inject(ActivatedRoute).snapshot.queryParamMap.get("token") ?? "";

    form = inject(NonNullableFormBuilder).group(
        {
            newPassword: [
                "",
                [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
            ],
            confirmPassword: ["", Validators.required],
        },
        { validators: passwordsMatch },
    );

    hasToken = this.token.length > 0;
    loading = signal(false);
    error = signal<string | null>(null);
    // Le lien est refusé : on propose d'en demander un autre
    expired = signal(false);
    done = signal(false);
    showPassword = signal(false);

    invalid(name: "newPassword" | "confirmPassword") {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.auth.resetPassword(this.token, this.form.getRawValue().newPassword).subscribe({
            next: () => {
                this.loading.set(false);
                // Le mot de passe a changé : une session ouverte sur cet appareil ne vaut plus rien
                this.auth.endSession();
                this.done.set(true);
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                if (err.status === 0 || err.status >= 502) {
                    this.error.set("Impossible de joindre le serveur. Vérifiez votre connexion.");
                } else if (err.status === 400 && /lien/i.test(err.error?.message ?? "")) {
                    this.expired.set(true);
                } else {
                    this.error.set(err.error?.message ?? "Une erreur est survenue, réessayez.");
                }
            },
        });
    }
}

import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";

@Component({
    selector: "app-login",
    imports: [ReactiveFormsModule, RouterLink, Icon],
    templateUrl: "./login.html",
    styleUrls: ["../auth-form.css", "./login.css"],
})
export class Login {
    private auth = inject(AuthService);
    private router = inject(Router);
    private fb = inject(NonNullableFormBuilder);

    form = this.fb.group({
        email: ["", [Validators.required, Validators.email]],
        password: ["", Validators.required],
        remember: [true],
    });

    productName = PRODUCT_NAME;

    loading = signal(false);
    error = signal<string | null>(null);
    showPassword = signal(false);

    hasError(field: "email" | "password", code: string) {
        const control = this.form.controls[field];
        return control.touched && control.hasError(code);
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        const { email, password, remember } = this.form.getRawValue();

        this.auth.login(email.trim(), password, remember).subscribe({
            next: () => {
                if (this.auth.user()?.mustChangePassword) {
                    this.router.navigate(["/settings/password"]);
                    return;
                }
                this.router.navigate([this.auth.isOwner() ? "/owner" : "/dashboard"]);
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

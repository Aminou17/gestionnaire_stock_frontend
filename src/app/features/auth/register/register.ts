import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { LogoResizerService } from "../../settings/logo-resizer.service";

type Field = "shopName" | "adminName" | "email" | "password";

@Component({
    selector: "app-register",
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: "./register.html",
    styleUrls: ["../login/login.css", "./register.css"],
})
export class Register {
    private auth = inject(AuthService);
    private router = inject(Router);
    private fb = inject(NonNullableFormBuilder);
    private resizer = inject(LogoResizerService);

    // mêmes limites que l'API
    form = this.fb.group({
        shopName: ["", [Validators.required, Validators.maxLength(80)]],
        adminName: ["", [Validators.required, Validators.maxLength(100)]],
        email: ["", [Validators.required, Validators.email]],
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    });

    loading = signal(false);
    error = signal<string | null>(null);
    showPassword = signal(false);

    // logo facultatif : réduit tout de suite, envoyé avec l'inscription
    logo = signal<string | null>(null);
    logoError = signal<string | null>(null);

    async onLogoChosen(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        this.logoError.set(null);

        try {
            this.logo.set(await this.resizer.resize(file));
        } catch (err) {
            this.logoError.set((err as Error).message);
        }
    }

    removeLogo() {
        this.logo.set(null);
        this.logoError.set(null);
    }

    hasError(field: Field, code: string) {
        const control = this.form.controls[field];
        return control.touched && control.hasError(code);
    }

    isInvalid(field: Field) {
        const control = this.form.controls[field];
        return control.touched && control.invalid;
    }

    submit() {
        // des espaces seuls passent Validators.required
        for (const field of ["shopName", "adminName"] as const) {
            const control = this.form.controls[field];
            control.setValue(control.value.trim());
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        const { shopName, adminName, email, password } = this.form.getRawValue();

        const logo = this.logo();

        // l'API n'accepte que des emails en minuscules
        this.auth
            .register({
                shopName,
                adminName,
                email: email.trim().toLowerCase(),
                password,
                ...(logo ? { logo } : {}),
            })
            .subscribe({
                next: () => this.router.navigate(["/dashboard"]),
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    if (err.status === 0 || err.status >= 502) {
                        this.error.set(
                            "Impossible de joindre le serveur. Vérifiez votre connexion.",
                        );
                    } else {
                        this.error.set(err.error?.message ?? "Une erreur est survenue, réessayez.");
                    }
                },
            });
    }
}

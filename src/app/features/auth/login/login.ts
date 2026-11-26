import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";
import { GoogleButton } from "../google-button/google-button";

@Component({
    selector: "app-login",
    imports: [ReactiveFormsModule, RouterLink, Icon, GoogleButton],
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

    // Propriétaire avec la double authentification : deuxième étape avec un code
    step = signal<"password" | "code">("password");
    useBackupCode = signal(false);
    codeControl = this.fb.control("", Validators.required);
    private twoFactorToken = "";

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
            next: (challenge) => {
                if (challenge?.twoFactorRequired) {
                    this.twoFactorToken = challenge.twoFactorToken;
                    this.loading.set(false);
                    this.step.set("code");
                    return;
                }
                this.enterApp();
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                // Inscription jamais confirmée : un nouveau code vient de partir
                if (err.error?.code === "EMAIL_NOT_VERIFIED") {
                    this.router.navigate(["/verify-email"], {
                        queryParams: { email: err.error.email ?? email.trim() },
                    });
                    return;
                }
                this.error.set(this.messageFor(err));
            },
        });
    }

    onGoogle(credential: string) {
        this.loading.set(true);
        this.error.set(null);

        this.auth.loginWithGoogle(credential).subscribe({
            next: (loggedIn) => {
                if (loggedIn) {
                    this.enterApp();
                    return;
                }
                // Première visite avec ce compte Google : il reste à créer la boutique
                this.router.navigate(["/register"]);
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                this.error.set(this.messageFor(err));
            },
        });
    }

    // Un code de 6 chiffres complet part tout seul, sans appuyer sur le bouton
    onCodeInput() {
        const value = this.codeControl.value;
        if (!this.useBackupCode() && /^\d{6}$/.test(value)) this.submitCode();
    }

    submitCode() {
        const code = this.codeControl.value.trim();
        if (!code || this.loading()) return;

        this.loading.set(true);
        this.error.set(null);

        this.auth
            .verifyTwoFactor(this.twoFactorToken, code, this.form.controls.remember.value)
            .subscribe({
                next: () => this.enterApp(),
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    // Le jeton dure 5 minutes : au-delà, on repart du mot de passe en gardant le message
                    if (err.status === 401 && err.error?.message?.includes("expiré")) {
                        this.backToPassword(this.messageFor(err));
                        return;
                    }
                    this.error.set(this.messageFor(err));
                    this.codeControl.reset("");
                },
            });
    }

    toggleBackupCode() {
        this.useBackupCode.set(!this.useBackupCode());
        this.codeControl.reset("");
        this.error.set(null);
    }

    // Message : affiché sur l'écran du mot de passe (par exemple "étape expirée")
    backToPassword(message: string | null = null) {
        this.step.set("password");
        this.useBackupCode.set(false);
        this.codeControl.reset("");
        this.twoFactorToken = "";
        this.error.set(message);
    }

    private enterApp() {
        if (this.auth.user()?.mustChangePassword) {
            this.router.navigate(["/settings/password"]);
            return;
        }
        this.router.navigate([this.auth.isOwner() ? "/owner" : "/dashboard"]);
    }

    private messageFor(err: HttpErrorResponse) {
        if (err.status === 0 || err.status >= 502) {
            return "Impossible de joindre le serveur. Vérifiez votre connexion.";
        }
        return err.error?.message ?? "Une erreur est survenue, réessayez.";
    }
}

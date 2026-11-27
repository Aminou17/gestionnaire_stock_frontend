import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidatorFn,
    Validators,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { countryForCode } from "../../../shared/country-codes";
import { Icon } from "../../../shared/icon/icon";
import { PhoneField } from "../../../shared/phone-field/phone-field";
import { splitPhone } from "../../../shared/phone";
import { GoogleButton } from "../google-button/google-button";
import { PasswordHint } from "../password-hint/password-hint";

// 8 à 15 chiffres avec l'indicatif, comme l'API
const phoneLength: ValidatorFn = (control) => {
    const digits = String(control.value ?? "").replace(/\D/g, "");
    return !digits || (digits.length >= 8 && digits.length <= 15) ? null : { phone: true };
};

type Field = "adminName" | "phone" | "email" | "password";

@Component({
    selector: "app-register",
    imports: [ReactiveFormsModule, RouterLink, Icon, PasswordHint, PhoneField, GoogleButton],
    templateUrl: "./register.html",
    styleUrls: ["../auth-form.css", "./register.css"],
})
export class Register {
    private auth = inject(AuthService);
    private router = inject(Router);
    private fb = inject(NonNullableFormBuilder);

    // Mêmes limites que l'API
    form = this.fb.group({
        // Nom complet : l'API le découpe au dernier espace
        adminName: ["", [Validators.required, Validators.maxLength(50)]],
        // +226 70 12 34 56 : au moins 8 chiffres avec l'indicatif
        phone: ["", [Validators.required, phoneLength]],
        // Validators.email accepte "nom@domaine" : on exige aussi un point dans le domaine
        email: [
            "",
            [Validators.required, Validators.email, Validators.pattern(/^\S+@\S+\.\S{2,}$/)],
        ],
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    });

    // Piège à robots : champ invisible pour une personne, et durée de remplissage
    website = signal("");
    private startedAt = Date.now();

    loading = signal(false);
    done = signal(false);
    error = signal<string | null>(null);
    showPassword = signal(false);
    // L'adresse e-mail a déjà un compte : rien n'a été créé
    emailTaken = signal(false);

    // Indicatif proposé au départ : celui du pays où Boutiki démarre
    protected defaultCode = "226";

    // Le numéro est vérifié pendant la saisie, comme chez Shopify ou Stripe
    phoneStatus = signal<"idle" | "checking" | "free" | "taken" | "unknown">("idle");
    phoneMessage = signal("");

    protected free = toSignal(this.auth.isFree(), { initialValue: false });

    // Compte Google en attente de sa boutique : seul le numéro reste à donner
    google = this.auth.googleSignup;

    constructor() {
        const phone = this.form.controls.phone;

        phone.valueChanges
            .pipe(
                tap(() => this.phoneStatus.set(phone.valid ? "checking" : "idle")),
                debounceTime(500),
                distinctUntilChanged(),
                filter(() => phone.valid),
                switchMap((value) =>
                    this.auth.isPhoneAvailable(value).pipe(
                        // Un serveur injoignable ne doit pas bloquer l'inscription : l'API revérifie
                        catchError(() => of(null)),
                    ),
                ),
                takeUntilDestroyed(),
            )
            .subscribe((result) => {
                if (!result) {
                    this.phoneStatus.set("unknown");
                    return;
                }
                this.phoneStatus.set(result.available ? "free" : "taken");
                this.phoneMessage.set(result.message ?? "");
            });
    }

    // Les erreurs ne s'affichent qu'après le premier appui sur le bouton, pas en passant d'un champ à l'autre
    protected submitted = signal(false);

    hasError(field: Field, code: string) {
        const control = this.form.controls[field];
        return this.submitted() && control.hasError(code);
    }

    isInvalid(field: Field) {
        const control = this.form.controls[field];
        return this.submitted() && control.invalid;
    }

    // Le pays vient de l'indicatif ; la ville et le reste se complètent dans les paramètres
    private contact() {
        const phone = this.form.controls.phone.value;
        return { phone, country: countryForCode(splitPhone(phone, this.defaultCode).code) };
    }

    onGoogle(credential: string) {
        this.loading.set(true);
        this.error.set(null);

        this.auth.loginWithGoogle(credential).subscribe({
            next: (loggedIn) => {
                this.loading.set(false);
                // Compte déjà inscrit : on l'ouvre ; sinon la page passe en mode Google
                if (loggedIn) this.router.navigate([this.auth.isOwner() ? "/owner" : "/dashboard"]);
            },
            error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                this.error.set(this.messageFor(err));
            },
        });
    }

    // Choisir une autre adresse : on repart de l'inscription normale
    leaveGoogle() {
        this.auth.googleSignup.set(null);
    }

    submit() {
        this.submitted.set(true);
        const google = this.google();
        if (google) {
            this.submitGoogle(google.credential);
            return;
        }

        // Des espaces seuls passent Validators.required
        const name = this.form.controls.adminName;
        name.setValue(name.value.trim());

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        if (this.phoneStatus() === "taken") return;

        this.startSending();

        const { adminName, email, password } = this.form.getRawValue();

        // L'API n'accepte que des emails en minuscules
        this.auth
            .register({
                adminName,
                ...this.contact(),
                email: email.trim().toLowerCase(),
                password,
                website: this.website(),
                elapsedMs: Date.now() - this.startedAt,
            })
            .subscribe({
                next: (result) => {
                    this.done.set(true);
                    this.router.navigate(["/verify-email"], {
                        queryParams: { email: result.email },
                    });
                },
                error: (err: HttpErrorResponse) => this.showError(err),
            });
    }

    private submitGoogle(credential: string) {
        const phone = this.form.controls.phone;
        phone.markAsTouched();
        if (phone.invalid || this.phoneStatus() === "taken") return;

        this.startSending();

        this.auth.registerWithGoogle({ credential, ...this.contact() }).subscribe({
            next: () => {
                this.done.set(true);
                this.router.navigate(["/dashboard"]);
            },
            error: (err: HttpErrorResponse) => {
                // Le jeton Google dure environ une heure
                if (err.status === 401) {
                    this.loading.set(false);
                    this.leaveGoogle();
                    this.error.set("La connexion avec Google a expiré, recommencez.");
                    return;
                }
                this.showError(err);
            },
        });
    }

    private startSending() {
        this.loading.set(true);
        this.error.set(null);
        this.emailTaken.set(false);
    }

    private showError(err: HttpErrorResponse) {
        this.loading.set(false);

        // Le numéro a été pris entre-temps : le message s'affiche sous le champ
        if (err.status === 409 && err.error?.message?.includes("numéro")) {
            this.phoneStatus.set("taken");
            this.phoneMessage.set(err.error.message);
        } else if (err.status === 409) {
            this.emailTaken.set(true);
            this.error.set("Cette adresse e-mail a déjà un compte. Aucune boutique n'a été créée.");
        } else {
            this.error.set(this.messageFor(err));
        }
    }

    private messageFor(err: HttpErrorResponse) {
        if (err.status === 0 || err.status >= 502) {
            return "Impossible de joindre le serveur. Vérifiez votre connexion.";
        }
        return err.error?.message ?? "Une erreur est survenue, réessayez.";
    }
}

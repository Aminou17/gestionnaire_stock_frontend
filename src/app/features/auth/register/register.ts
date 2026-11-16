import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal } from "@angular/core";
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
import { COUNTRY_OPTIONS, countryForCode } from "../../../shared/country-codes";
import { Icon } from "../../../shared/icon/icon";
import { PhoneField } from "../../../shared/phone-field/phone-field";
import { splitPhone } from "../../../shared/phone";
import { LogoResizerService } from "../../settings/logo-resizer.service";
import { PasswordStrength } from "../password-strength/password-strength";

// 8 à 15 chiffres avec l'indicatif, comme l'API
const phoneLength: ValidatorFn = (control) => {
    const digits = String(control.value ?? "").replace(/\D/g, "");
    return !digits || (digits.length >= 8 && digits.length <= 15) ? null : { phone: true };
};

type Field = "shopName" | "phone" | "country" | "city" | "firstName" | "lastName" | "email" | "password";

@Component({
    selector: "app-register",
    imports: [ReactiveFormsModule, RouterLink, Icon, PasswordStrength, PhoneField],
    templateUrl: "./register.html",
    styleUrls: ["../auth-form.css", "./register.css"],
})
export class Register {
    private auth = inject(AuthService);
    private router = inject(Router);
    private fb = inject(NonNullableFormBuilder);
    private resizer = inject(LogoResizerService);
    private host = inject<ElementRef<HTMLElement>>(ElementRef);

    // mêmes limites que l'API
    form = this.fb.group({
        shopName: ["", [Validators.required, Validators.maxLength(80)]],
        // +226 70 12 34 56 : au moins 8 chiffres avec l'indicatif
        phone: ["", [Validators.required, phoneLength]],
        country: ["", [Validators.required, Validators.maxLength(80)]],
        city: ["", [Validators.required, Validators.maxLength(80)]],
        firstName: ["", [Validators.required, Validators.maxLength(50)]],
        lastName: ["", [Validators.required, Validators.maxLength(50)]],
        // Validators.email accepte "nom@domaine" : on exige aussi un point dans le domaine
        email: [
            "",
            [Validators.required, Validators.email, Validators.pattern(/^\S+@\S+\.\S{2,}$/)],
        ],
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    });

    // 1 : la boutique, 2 : le compte de l'administrateur
    step = signal<1 | 2>(1);
    loading = signal(false);
    done = signal(false);
    error = signal<string | null>(null);
    showPassword = signal(false);

    // indicatif proposé au départ : celui du pays où Boutiki démarre
    protected defaultCode = "226";
    protected countries = COUNTRY_OPTIONS;

    // le numéro est vérifié pendant la saisie, comme chez Shopify ou Stripe
    phoneStatus = signal<"idle" | "checking" | "free" | "taken" | "unknown">("idle");
    phoneMessage = signal("");

    // sens de la transition entre les deux étapes
    direction = signal<"forward" | "back">("forward");

    // aperçu en direct de la boutique
    private shopNameValue = toSignal(this.form.controls.shopName.valueChanges, {
        initialValue: "",
    });
    previewName = computed(() => this.shopNameValue().trim());

    constructor() {
        const phone = this.form.controls.phone;

        phone.valueChanges
            .pipe(
                tap((value) => {
                    this.phoneStatus.set(phone.valid ? "checking" : "idle");
                    this.suggestCountry(value);
                }),
                debounceTime(500),
                distinctUntilChanged(),
                filter(() => phone.valid),
                switchMap((value) =>
                    this.auth.isPhoneAvailable(value).pipe(
                        // un serveur injoignable ne doit pas bloquer l'inscription : l'API revérifie
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

    // le pays suit l'indicatif tant que la personne ne l'a pas choisi elle-même
    private suggestCountry(phone: string) {
        const country = this.form.controls.country;
        if (country.dirty || !phone) return;

        country.setValue(countryForCode(splitPhone(phone, this.defaultCode).code));
    }

    // logo facultatif : réduit tout de suite, envoyé avec l'inscription
    logo = signal<string | null>(null);
    logoError = signal<string | null>(null);
    dragging = signal(false);

    onLogoChosen(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";

        if (file) this.loadLogo(file);
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.dragging.set(true);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        this.dragging.set(false);

        const file = event.dataTransfer?.files?.[0];
        if (file) this.loadLogo(file);
    }

    private async loadLogo(file: File) {
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

    next() {
        // des espaces seuls passent Validators.required
        for (const field of ["shopName", "country", "city"] as const) {
            const control = this.form.controls[field];
            control.setValue(control.value.trim(), { emitEvent: false });
            control.markAsTouched();
        }
        this.form.controls.phone.markAsTouched();

        const { shopName, phone, country, city } = this.form.controls;
        if (shopName.invalid || phone.invalid || country.invalid || city.invalid) return;

        if (this.phoneStatus() === "taken") return;

        this.error.set(null);
        this.direction.set("forward");
        this.goTo(2, "#register-firstName");
    }

    back() {
        this.error.set(null);
        this.direction.set("back");
        this.goTo(1, "#register-shopName");
    }

    // le champ n'existe qu'après l'affichage de l'étape
    private goTo(step: 1 | 2, focus: string) {
        this.step.set(step);
        setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>(focus)?.focus());
    }

    submit() {
        if (this.step() === 1) {
            this.next();
            return;
        }

        for (const field of ["firstName", "lastName"] as const) {
            const control = this.form.controls[field];
            control.setValue(control.value.trim());
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        const { shopName, phone, country, city, firstName, lastName, email, password } =
            this.form.getRawValue();

        const logo = this.logo();

        // l'API n'accepte que des emails en minuscules
        this.auth
            .register({
                shopName,
                phone,
                country,
                city,
                firstName,
                lastName,
                email: email.trim().toLowerCase(),
                password,
                ...(logo ? { logo } : {}),
            })
            .subscribe({
                next: () => {
                    this.done.set(true);
                    this.router.navigate(["/dashboard"]);
                },
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    if (err.status === 0 || err.status >= 502) {
                        this.error.set(
                            "Impossible de joindre le serveur. Vérifiez votre connexion.",
                        );
                    } else if (err.status === 409 && err.error?.message?.includes("numéro")) {
                        // le numéro a été pris entre-temps : retour à l'étape de la boutique
                        this.phoneStatus.set("taken");
                        this.phoneMessage.set(err.error.message);
                        this.back();
                    } else {
                        this.error.set(err.error?.message ?? "Une erreur est survenue, réessayez.");
                    }
                },
            });
    }
}

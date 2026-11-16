import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { Icon } from "../../../shared/icon/icon";
import { LogoResizerService } from "../../settings/logo-resizer.service";
import { PasswordStrength } from "../password-strength/password-strength";

type Field = "shopName" | "firstName" | "lastName" | "email" | "password";

@Component({
    selector: "app-register",
    imports: [ReactiveFormsModule, RouterLink, Icon, PasswordStrength],
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

    // sens de la transition entre les deux étapes
    direction = signal<"forward" | "back">("forward");

    // aperçu en direct de la boutique
    private shopNameValue = toSignal(this.form.controls.shopName.valueChanges, {
        initialValue: "",
    });
    previewName = computed(() => this.shopNameValue().trim());

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
        const shopName = this.form.controls.shopName;
        shopName.setValue(shopName.value.trim());

        if (shopName.invalid) {
            shopName.markAsTouched();
            return;
        }

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

        const { shopName, firstName, lastName, email, password } = this.form.getRawValue();

        const logo = this.logo();

        // l'API n'accepte que des emails en minuscules
        this.auth
            .register({
                shopName,
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
                    } else {
                        this.error.set(err.error?.message ?? "Une erreur est survenue, réessayez.");
                    }
                },
            });
    }
}

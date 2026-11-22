import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";

import { HELP_REASONS } from "../../core/help/help.model";
import { HelpService } from "../../core/help/help.service";
import { Icon } from "../../shared/icon/icon";

// Page publique, ouverte depuis la connexion : pour qui ne peut plus entrer dans son compte.
// La réponse part par e-mail, à l'adresse laissée ici.
// les claviers de téléphone ajoutent souvent une espace après l'adresse : elle ne doit pas la rendre invalide
const trimmedEmail = (control: AbstractControl) =>
    Validators.email({ value: String(control.value ?? "").trim() } as AbstractControl);

@Component({
    selector: "app-help-form",
    imports: [ReactiveFormsModule, RouterLink, Icon],
    templateUrl: "./help-form.html",
    styleUrls: ["../auth/auth-form.css", "./help-form.css"],
})
export class HelpForm {
    private help = inject(HelpService);
    private fb = inject(NonNullableFormBuilder);
    // temps passé sur le formulaire : un robot l'envoie en quelques instants
    private openedAt = Date.now();

    reasons = HELP_REASONS;

    form = this.fb.group({
        reason: this.fb.control<"login" | "blocked" | "payment" | "other">("login"),
        name: ["", [Validators.required, Validators.maxLength(80)]],
        email: ["", [Validators.required, trimmedEmail, Validators.maxLength(100)]],
        shopName: ["", [Validators.maxLength(80)]],
        message: ["", [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
        // champ caché : seuls les robots le remplissent
        website: [""],
    });

    loading = signal(false);
    error = signal<string | null>(null);
    sentTo = signal<string | null>(null);

    hasError(name: "name" | "email" | "message", code: string) {
        const control = this.form.controls[name];
        return control.touched && control.hasError(code);
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const email = value.email.trim().toLowerCase();

        this.loading.set(true);
        this.error.set(null);

        this.help
            .send({
                reason: value.reason,
                name: value.name.trim(),
                email,
                shopName: value.shopName.trim() || undefined,
                message: value.message.trim(),
                website: value.website,
                elapsedMs: Date.now() - this.openedAt,
            })
            .subscribe({
                next: () => {
                    this.loading.set(false);
                    this.sentTo.set(email);
                },
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    this.error.set(
                        err.status === 0 || err.status >= 502
                            ? "Impossible de joindre le serveur. Vérifiez votre connexion."
                            : (err.error?.message ?? "Une erreur est survenue, réessayez."),
                    );
                },
            });
    }
}

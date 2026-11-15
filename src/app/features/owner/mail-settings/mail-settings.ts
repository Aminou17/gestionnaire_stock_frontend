import { HttpErrorResponse } from "@angular/common/http";
import { Component, effect, inject, signal, untracked } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { MailSettings, MailSettingsService } from "../mail-settings.service";

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// une espace collée avec l'adresse ne doit pas la rendre invalide
const emailValidator = (control: AbstractControl): ValidationErrors | null =>
    EMAIL.test(String(control.value ?? "").trim()) ? null : { email: true };

// Adresse Gmail qui envoie les e-mails du logiciel (mot de passe oublié, liens du propriétaire)
@Component({
    selector: "app-mail-settings",
    imports: [ReactiveFormsModule, RouterLink, Icon],
    templateUrl: "./mail-settings.html",
    styleUrl: "./mail-settings.css",
})
export class MailSettingsPage {
    private service = inject(MailSettingsService);
    private fb = inject(NonNullableFormBuilder);

    settings = rxResource({ stream: () => this.service.get() });

    form = this.fb.group({
        gmailUser: ["", [Validators.required, emailValidator, Validators.maxLength(150)]],
        gmailPassword: [""],
    });

    saving = signal(false);
    testing = signal(false);
    message = signal<{ ok: boolean; text: string } | null>(null);

    constructor() {
        effect(() => {
            if (!this.settings.hasValue()) return;
            const settings = this.settings.value();
            // un rechargement ne doit pas effacer une saisie en cours
            untracked(() => {
                if (!this.form.dirty) this.fill(settings);
            });
        });
    }

    private fill(settings: MailSettings) {
        this.form.reset({ gmailUser: settings.gmailUser ?? "", gmailPassword: "" });
    }

    invalid(name: "gmailUser") {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    // le mot de passe est obligatoire tant qu'aucun n'est enregistré
    needsPassword() {
        const settings = this.settings.hasValue() ? this.settings.value() : null;
        return !settings?.hasPassword;
    }

    save() {
        const { gmailUser, gmailPassword } = this.form.getRawValue();
        if (this.form.invalid || (this.needsPassword() && !gmailPassword.trim())) {
            this.form.markAllAsTouched();
            this.message.set({
                ok: false,
                text: this.form.invalid
                    ? "Indiquez une adresse Gmail valide."
                    : "Indiquez le mot de passe d'application Google.",
            });
            return;
        }

        this.saving.set(true);
        this.message.set(null);
        this.service.save(gmailUser.trim(), gmailPassword.trim()).subscribe({
            next: (settings) => {
                this.saving.set(false);
                this.fill(settings);
                this.settings.set(settings);
                this.message.set({ ok: true, text: "Adresse d'envoi enregistrée." });
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.message.set({
                    ok: false,
                    text: err.error?.message ?? "Impossible d'enregistrer, réessayez.",
                });
            },
        });
    }

    test() {
        this.testing.set(true);
        this.message.set(null);
        this.service.sendTest().subscribe({
            next: (res) => {
                this.testing.set(false);
                this.message.set({ ok: true, text: res.message });
            },
            error: (err: HttpErrorResponse) => {
                this.testing.set(false);
                this.message.set({
                    ok: false,
                    text: err.error?.message ?? "L'e-mail d'essai n'est pas parti.",
                });
            },
        });
    }

    remove() {
        this.saving.set(true);
        this.message.set(null);
        this.service.remove().subscribe({
            next: (settings) => {
                this.saving.set(false);
                this.fill(settings);
                this.settings.set(settings);
                this.message.set({ ok: true, text: "Adresse retirée." });
            },
            error: () => {
                this.saving.set(false);
                this.message.set({ ok: false, text: "Impossible de retirer, réessayez." });
            },
        });
    }
}

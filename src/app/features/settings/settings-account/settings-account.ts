import { Component, DestroyRef, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { filter } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";

const passwordsMatch = (group: AbstractControl): ValidationErrors | null => {
    const { newPassword, confirmPassword } = group.getRawValue();

    return newPassword === confirmPassword ? null : { mismatch: true };
};

@Component({
    selector: "app-settings-account",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog],
    templateUrl: "./settings-account.html",
    styleUrls: ["../settings-section.css", "./settings-account.css"],
})
export class SettingsAccount implements HasUnsavedChanges {
    protected auth = inject(AuthService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    private leaveDialog = viewChild.required(UnsavedDialog);

    profileForm = this.fb.group({
        name: [this.auth.user()?.name ?? "", [Validators.required, Validators.maxLength(100)]],
        email: [
            this.auth.user()?.email ?? "",
            [Validators.required, Validators.email, Validators.maxLength(150)],
        ],
    });

    passwordForm = this.fb.group(
        {
            currentPassword: ["", Validators.required],
            newPassword: ["", [Validators.required, Validators.minLength(8)]],
            confirmPassword: ["", Validators.required],
        },
        { validators: passwordsMatch },
    );

    savingProfile = signal(false);
    profileMessage = signal<{ ok: boolean; text: string } | null>(null);

    savingPassword = signal(false);
    passwordMessage = signal<{ ok: boolean; text: string } | null>(null);

    constructor() {
        // le bouton Changer le mot de passe des paramètres arrive ici avec #password
        if (inject(ActivatedRoute).snapshot.fragment === "password") {
            setTimeout(() =>
                document.getElementById("password")?.scrollIntoView({ block: "start" }),
            );
        }

        // dirty est faux après un reset : seule une saisie de l'utilisateur efface le message
        this.profileForm.valueChanges
            .pipe(
                filter(() => this.profileForm.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.profileMessage.set(null));

        this.passwordForm.valueChanges
            .pipe(
                filter(() => this.passwordForm.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.passwordMessage.set(null));
    }

    invalidProfile(name: keyof typeof this.profileForm.controls) {
        const control = this.profileForm.controls[name];
        return control.touched && control.invalid;
    }

    invalidPassword(name: keyof typeof this.passwordForm.controls) {
        const control = this.passwordForm.controls[name];
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.savingProfile() || this.savingPassword()) return false;

        const dirty = this.profileForm.dirty || this.passwordForm.dirty;

        return !dirty || this.leaveDialog().ask();
    }

    cancelProfile() {
        this.profileMessage.set(null);
        this.resetProfile();
    }

    saveProfile() {
        this.profileForm.markAllAsTouched();
        if (this.profileForm.invalid) return;

        const { name, email } = this.profileForm.getRawValue();

        this.savingProfile.set(true);
        this.profileMessage.set(null);
        this.profileForm.disable({ emitEvent: false });

        // le backend n'accepte que les adresses en minuscules
        this.auth
            .updateProfile(name.trim(), email.trim().toLowerCase())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.savingProfile.set(false);
                    this.profileForm.enable({ emitEvent: false });
                    this.resetProfile();
                    this.profileMessage.set({ ok: true, text: "Profil enregistré." });
                },
                error: (err) => {
                    this.savingProfile.set(false);
                    this.profileForm.enable({ emitEvent: false });
                    this.profileMessage.set({
                        ok: false,
                        text: errorText(err, "Impossible d'enregistrer le profil."),
                    });
                },
            });
    }

    savePassword() {
        this.passwordForm.markAllAsTouched();
        if (this.passwordForm.invalid) return;

        const { currentPassword, newPassword } = this.passwordForm.getRawValue();

        this.savingPassword.set(true);
        this.passwordMessage.set(null);
        this.passwordForm.disable({ emitEvent: false });

        this.auth
            .changePassword(currentPassword, newPassword)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.savingPassword.set(false);
                    this.passwordForm.enable({ emitEvent: false });
                    this.passwordForm.reset();
                    this.passwordMessage.set({ ok: true, text: "Mot de passe modifié." });
                },
                error: (err) => {
                    this.savingPassword.set(false);
                    this.passwordForm.enable({ emitEvent: false });
                    this.passwordMessage.set({
                        ok: false,
                        text: errorText(err, "Impossible de modifier le mot de passe."),
                    });
                },
            });
    }

    private resetProfile() {
        const user = this.auth.user();

        this.profileForm.reset({ name: user?.name ?? "", email: user?.email ?? "" });
    }
}

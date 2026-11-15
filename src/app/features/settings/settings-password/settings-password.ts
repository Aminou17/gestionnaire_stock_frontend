import { Component, DestroyRef, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
    AbstractControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
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
    selector: "app-settings-password",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog],
    templateUrl: "./settings-password.html",
    styleUrls: ["../settings-section.css", "./settings-password.css"],
})
export class SettingsPassword implements HasUnsavedChanges {
    protected auth = inject(AuthService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);
    private router = inject(Router);

    private leaveDialog = viewChild.required(UnsavedDialog);

    passwordForm = this.fb.group(
        {
            currentPassword: ["", Validators.required],
            newPassword: ["", [Validators.required, Validators.minLength(8)]],
            confirmPassword: ["", Validators.required],
        },
        { validators: passwordsMatch },
    );

    savingPassword = signal(false);
    passwordMessage = signal<{ ok: boolean; text: string } | null>(null);

    constructor() {
        // dirty est faux après un reset : seule une saisie de l'utilisateur efface le message
        this.passwordForm.valueChanges
            .pipe(
                filter(() => this.passwordForm.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.passwordMessage.set(null));
    }

    invalidPassword(name: keyof typeof this.passwordForm.controls) {
        const control = this.passwordForm.controls[name];
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.savingPassword()) return false;

        const dirty = this.passwordForm.dirty;

        return !dirty || this.leaveDialog().ask();
    }

    savePassword() {
        this.passwordForm.markAllAsTouched();
        if (this.passwordForm.invalid) return;

        const { currentPassword, newPassword } = this.passwordForm.getRawValue();
        // avec un mot de passe provisoire, on repart vers l'application une fois le changement fait
        const forced = this.auth.user()?.mustChangePassword === true;

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
                    if (forced)
                        this.router.navigate([this.auth.isOwner() ? "/owner" : "/dashboard"]);
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
}

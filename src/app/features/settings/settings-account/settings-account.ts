import { Component, DestroyRef, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { filter } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Avatar } from "../../../shared/avatar/avatar";
import { resizeAvatar } from "../../../shared/avatar/avatar-resizer";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";

@Component({
    selector: "app-settings-account",
    imports: [ReactiveFormsModule, PageHeader, Icon, Avatar, UnsavedDialog],
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

    savingPhoto = signal(false);
    photoError = signal("");

    savingProfile = signal(false);
    profileMessage = signal<{ ok: boolean; text: string } | null>(null);

    constructor() {
        // dirty est faux après un reset : seule une saisie de l'utilisateur efface le message
        this.profileForm.valueChanges
            .pipe(
                filter(() => this.profileForm.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.profileMessage.set(null));
    }

    invalidProfile(name: keyof typeof this.profileForm.controls) {
        const control = this.profileForm.controls[name];
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.savingProfile()) return false;

        const dirty = this.profileForm.dirty;

        return !dirty || this.leaveDialog().ask();
    }

    async onPhoto(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        this.photoError.set("");
        try {
            this.sendPhoto(await resizeAvatar(file));
        } catch (err) {
            this.photoError.set((err as Error).message);
        }
    }

    removePhoto() {
        this.photoError.set("");
        this.sendPhoto(null);
    }

    private sendPhoto(avatar: string | null) {
        this.savingPhoto.set(true);
        this.auth
            .updateAvatar(avatar)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.savingPhoto.set(false),
                error: (err) => {
                    this.savingPhoto.set(false);
                    this.photoError.set(errorText(err, "Impossible d'enregistrer la photo."));
                },
            });
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

    private resetProfile() {
        const user = this.auth.user();

        this.profileForm.reset({ name: user?.name ?? "", email: user?.email ?? "" });
    }
}

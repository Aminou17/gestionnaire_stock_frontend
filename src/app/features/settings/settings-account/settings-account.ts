import { Component, DestroyRef, computed, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { filter } from "rxjs";

import { AuthService, User } from "../../../core/auth/auth.service";
import { joinName, splitName } from "../../../core/auth/person-name";
import { ThemeService } from "../../../core/theme/theme.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Avatar } from "../../../shared/avatar/avatar";
import { resizeAvatar } from "../../../shared/avatar/avatar-resizer";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";
import { getBackLink } from "../../../core/back-link";

// une session ouverte avant l'arrivée du prénom et du nom n'a que le nom complet
const namesOf = (user: User | null) => {
    if (!user) return { firstName: "", lastName: "" };
    if (user.firstName !== undefined)
        return { firstName: user.firstName, lastName: user.lastName ?? "" };

    return splitName(user.name);
};

@Component({
    selector: "app-settings-account",
    imports: [ReactiveFormsModule, RouterLink, PageHeader, Icon, Avatar, UnsavedDialog],
    templateUrl: "./settings-account.html",
    styleUrls: ["../settings-section.css", "./settings-account.css"],
})
export class SettingsAccount implements HasUnsavedChanges {
    protected back = getBackLink("/settings", "Retour aux paramètres");
    protected auth = inject(AuthService);
    protected theme = inject(ThemeService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    private leaveDialog = viewChild.required(UnsavedDialog);

    profileForm = this.fb.group({
        firstName: [
            namesOf(this.auth.user()).firstName,
            [Validators.required, Validators.maxLength(50)],
        ],
        lastName: [namesOf(this.auth.user()).lastName, [Validators.maxLength(50)]],
        email: [
            this.auth.user()?.email ?? "",
            [Validators.required, Validators.email, Validators.maxLength(150)],
        ],
    });

    private formValue = toSignal(this.profileForm.valueChanges);

    // l'en-tête montre le nom tel qu'il sera enregistré, pendant la saisie
    fullName = computed(() => {
        const value = this.formValue();
        if (!value) return this.auth.user()?.name ?? "";

        return (
            joinName(value.firstName ?? "", value.lastName ?? "") || (this.auth.user()?.name ?? "")
        );
    });

    savingPhoto = signal(false);
    photoError = signal("");

    savingProfile = signal(false);
    profileMessage = signal<{ ok: boolean; text: string } | null>(null);

    sendingReset = signal(false);
    resetMessage = signal<{ ok: boolean; text: string } | null>(null);

    // même service que la page Mot de passe oublié, avec l'adresse du compte connecté
    sendReset() {
        const email = this.auth.user()?.email;
        if (!email || this.sendingReset()) return;

        this.sendingReset.set(true);
        this.resetMessage.set(null);
        this.auth.forgotPassword(email).subscribe({
            next: () => {
                this.sendingReset.set(false);
                this.resetMessage.set({ ok: true, text: `Un lien a été envoyé à ${email}.` });
            },
            error: (err) => {
                this.sendingReset.set(false);
                this.resetMessage.set({
                    ok: false,
                    text: err.error?.message ?? "Impossible d'envoyer le lien, réessayez.",
                });
            },
        });
    }

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

        const { firstName, lastName, email } = this.profileForm.getRawValue();

        this.savingProfile.set(true);
        this.profileMessage.set(null);
        this.profileForm.disable({ emitEvent: false });

        // le backend n'accepte que les adresses en minuscules
        this.auth
            .updateProfile(firstName.trim(), lastName.trim(), email.trim().toLowerCase())
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

        this.profileForm.reset({ ...namesOf(user), email: user?.email ?? "" });
    }
}

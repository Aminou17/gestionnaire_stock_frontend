import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { Icon } from "../../../shared/icon/icon";
import { generatePassword } from "../user-display";
import { UserAccount } from "../user.model";
import { UserService } from "../user.service";
import { copyText } from "../../../shared/copy-text";

// L'administrateur donne un nouveau mot de passe à quelqu'un qui a oublié le sien
@Component({
    selector: "app-password-dialog",
    imports: [ReactiveFormsModule, Icon],
    templateUrl: "./password-dialog.html",
    styleUrl: "./password-dialog.css",
})
export class PasswordDialog {
    private userService = inject(UserService);
    private destroyRef = inject(DestroyRef);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
    private passwordInput = viewChild<ElementRef<HTMLInputElement>>("passwordInput");

    user = signal<UserAccount | null>(null);
    saving = signal(false);
    error = signal<string | null>(null);
    showPassword = signal(false);
    // Mot de passe enregistré, montré une dernière fois pour le transmettre
    savedPassword = signal<string | null>(null);
    copied = signal(false);

    form = inject(NonNullableFormBuilder).group({
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    });

    open(user: UserAccount) {
        this.user.set(user);
        this.error.set(null);
        this.savedPassword.set(null);
        this.copied.set(false);
        this.showPassword.set(false);
        this.form.reset({ password: "" });
        this.dialog().nativeElement.showModal();
        this.passwordInput()?.nativeElement.focus();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Aussi appelé quand Échap ferme la fenêtre : le mot de passe ne reste pas dans la page
    onClosed() {
        this.savedPassword.set(null);
        this.form.reset({ password: "" });
    }

    onBackdrop(event: MouseEvent) {
        if (event.target !== event.currentTarget || this.form.dirty) return;
        this.close();
    }

    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    toggleShowPassword() {
        this.showPassword.update((show) => !show);
    }

    fillPassword() {
        this.form.controls.password.setValue(generatePassword());
        this.form.controls.password.markAsDirty();
        this.showPassword.set(true);
    }

    copyPassword() {
        const password = this.savedPassword();
        if (!password) return;
        copyText(password).then((ok) =>
            ok ? this.copied.set(true) : this.error.set("Copie impossible, recopiez-le à la main."),
        );
    }

    submit() {
        const user = this.user();
        if (!user || this.saving()) return;
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const password = this.form.controls.password.value;
        this.saving.set(true);
        this.error.set(null);

        this.userService
            .resetPassword(user.id, password)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.savedPassword.set(password);
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible de changer le mot de passe.");
                },
            });
    }
}

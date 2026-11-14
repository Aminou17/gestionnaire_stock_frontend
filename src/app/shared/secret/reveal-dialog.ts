import { Component, ElementRef, effect, inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../../core/auth/auth.service";
import { SecretValues } from "./secret-values";

// Demande le mot de passe avant d'afficher une valeur masquée ; placée une fois dans la mise en page
@Component({
    selector: "app-reveal-dialog",
    imports: [FormsModule],
    templateUrl: "./reveal-dialog.html",
    styleUrl: "./reveal-dialog.css",
})
export class RevealDialog {
    private auth = inject(AuthService);
    private secret = inject(SecretValues);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    password = signal("");
    checking = signal(false);
    error = signal<string | null>(null);

    constructor() {
        effect(() => {
            const dialog = this.dialog().nativeElement;
            if (this.secret.askOpen() && !dialog.open) {
                this.password.set("");
                this.error.set(null);
                dialog.showModal();
            } else if (!this.secret.askOpen() && dialog.open) {
                dialog.close();
            }
        });
    }

    submit() {
        if (!this.password() || this.checking()) return;
        this.checking.set(true);
        this.error.set(null);

        this.auth.verifyPassword(this.password()).subscribe({
            next: () => {
                this.checking.set(false);
                this.secret.unlock();
            },
            error: (err) => {
                this.checking.set(false);
                this.error.set(
                    err.status === 400
                        ? "Mot de passe incorrect."
                        : err.status === 429
                          ? "Trop de tentatives, réessayez dans quelques minutes."
                          : "Impossible de vérifier le mot de passe.",
                );
            },
        });
    }

    // Échap ou clic ailleurs : le mot de passe ne reste pas dans la page
    onClosed() {
        this.password.set("");
        this.secret.askOpen.set(false);
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.dialog().nativeElement.close();
    }
}

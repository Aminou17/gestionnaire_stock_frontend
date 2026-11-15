import { Component, ElementRef, effect, inject, viewChild } from "@angular/core";

import { AuthService } from "../../core/auth/auth.service";

// Demande confirmation avant de se déconnecter ; placée une fois dans chaque mise en page
@Component({
    selector: "app-logout-dialog",
    templateUrl: "./logout-dialog.html",
    styleUrl: "./logout-dialog.css",
})
export class LogoutDialog {
    protected auth = inject(AuthService);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    constructor() {
        effect(() => {
            const dialog = this.dialog().nativeElement;
            if (this.auth.logoutAsked() && !dialog.open) dialog.showModal();
            else if (!this.auth.logoutAsked() && dialog.open) dialog.close();
        });
    }

    stay() {
        this.auth.logoutAsked.set(false);
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.stay();
    }
}

import { Component, ElementRef, effect, inject, viewChild } from "@angular/core";

import { AuthService } from "../../core/auth/auth.service";
import { SaleOutboxService } from "../../core/offline/sale-outbox.service";

// Demande confirmation avant de se déconnecter ; placée une fois dans chaque mise en page
@Component({
    selector: "app-logout-dialog",
    templateUrl: "./logout-dialog.html",
    styleUrl: "./logout-dialog.css",
})
export class LogoutDialog {
    protected auth = inject(AuthService);
    // Les ventes faites sans internet restent sur l'appareil et partiront à la prochaine connexion du même compte
    protected outbox = inject(SaleOutboxService);

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

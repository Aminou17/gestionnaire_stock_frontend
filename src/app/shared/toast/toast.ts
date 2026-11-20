import { Component, inject } from "@angular/core";

import { Icon } from "../icon/icon";
import { ToastService } from "./toast.service";

// la zone reste dans la page (vide) pour que les lecteurs d'écran annoncent chaque message
@Component({
    selector: "app-toast",
    imports: [Icon],
    template: `
        <div class="zone" role="status" aria-live="polite">
            @if (toast.message(); as message) {
                <div class="toast">
                    <app-icon name="check" [size]="18" />
                    <span>{{ message }}</span>
                    <button type="button" aria-label="Fermer" (click)="toast.hide()">
                        <app-icon name="close" [size]="16" />
                    </button>
                </div>
            }
        </div>
    `,
    styleUrl: "./toast.css",
})
export class Toast {
    protected toast = inject(ToastService);
}

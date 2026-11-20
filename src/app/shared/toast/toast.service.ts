import { Injectable, signal } from "@angular/core";

// Petit message de confirmation en bas de l'écran (« Produit enregistré »).
// Il disparaît seul après quelques secondes ; un nouveau message remplace l'ancien.
@Injectable({ providedIn: "root" })
export class ToastService {
    readonly message = signal<string | null>(null);
    private timer: ReturnType<typeof setTimeout> | undefined;

    show(message: string, duration = 3000) {
        clearTimeout(this.timer);
        this.message.set(message);
        this.timer = setTimeout(() => this.message.set(null), duration);
    }

    hide() {
        clearTimeout(this.timer);
        this.message.set(null);
    }
}

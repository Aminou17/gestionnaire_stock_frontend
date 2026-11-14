import { Injectable, signal } from "@angular/core";

// Les valeurs sensibles (valeur du stock) restent masquées : on les masque à nouveau d'un clic,
// et on redonne le mot de passe pour les afficher. Rien n'est gardé après un rechargement.
@Injectable({ providedIn: "root" })
export class SecretValues {
    revealed = signal(false);
    askOpen = signal(false);

    toggle() {
        if (this.revealed()) {
            this.revealed.set(false);
        } else {
            this.askOpen.set(true);
        }
    }

    unlock() {
        this.revealed.set(true);
        this.askOpen.set(false);
    }
}

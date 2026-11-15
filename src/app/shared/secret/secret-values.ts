import { Injectable, signal } from "@angular/core";

// Les valeurs sensibles (valeur du stock) restent masquées au départ et s'affichent d'un clic.
// Rien n'est gardé après un rechargement.
@Injectable({ providedIn: "root" })
export class SecretValues {
    revealed = signal(false);

    toggle() {
        this.revealed.update((value) => !value);
    }
}

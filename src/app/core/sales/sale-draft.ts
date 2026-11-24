import { Injectable, effect, inject, signal } from "@angular/core";

import { AuthService } from "../auth/auth.service";
import { Product } from "../stock/product.model";

export interface CartLine {
    product: Product;
    quantity: number;
    // prix accordé : modifiable seulement pour un produit négociable
    unitPrice: number;
}

// Panier de la vente en cours : il vit en dehors de la page pour rester là quand on va voir
// un autre écran puis qu'on revient vendre. Il se vide à la vente, au bouton Vider et à la déconnexion.
@Injectable({ providedIn: "root" })
export class SaleDraft {
    readonly cart = signal<CartLine[]>([]);

    constructor() {
        const auth = inject(AuthService);

        // le panier d'une personne ne doit jamais apparaître chez la suivante
        effect(() => {
            if (!auth.user()) this.cart.set([]);
        });
    }
}

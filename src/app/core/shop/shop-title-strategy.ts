import { Injectable, Injector, computed, effect, inject, signal } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { RouterStateSnapshot, TitleStrategy } from "@angular/router";

import { PRODUCT_NAME } from "../brand";
import { ShopSettingsService } from "./shop-settings.service";

// Titre de l'onglet : la page puis le nom de la boutique (Produits · Chez Fatou). Le nom de la boutique arrive après la page,
// le titre se met donc à jour dès qu'il est connu. Sans boutique, le nom du logiciel.
@Injectable({ providedIn: "root" })
export class ShopTitleStrategy extends TitleStrategy {
    private title = inject(Title);
    private injector = inject(Injector);
    private page = signal<string | undefined>(undefined);
    private shop = signal<ShopSettingsService | null>(null);
    private shopName = computed(() => this.shop()?.shopName() ?? "");

    constructor() {
        super();
        effect(() => {
            const page = this.page();
            const brand = this.shopName() || PRODUCT_NAME;
            this.title.setTitle(page ? `${page} · ${brand}` : brand);
        });
    }

    override updateTitle(snapshot: RouterStateSnapshot) {
        // Cherché ici et pas à la création : ShopSettingsService dépend du Router,
        // qui crée lui-même cette stratégie (dépendance circulaire sinon)
        if (!this.shop()) this.shop.set(this.injector.get(ShopSettingsService));
        this.page.set(this.buildTitle(snapshot));
    }
}

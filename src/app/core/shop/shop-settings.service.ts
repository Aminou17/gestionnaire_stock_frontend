import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { DEFAULT_COUNTRY_CODE } from "../../shared/phone";
import { ShopSettings, ShopSettingsInput } from "./shop-settings.model";

@Injectable({ providedIn: "root" })
export class ShopSettingsService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);

    // boutique de la personne connectée, pour le menu et le titre de l'onglet ;
    // rechargée à chaque connexion, le propriétaire n'en a pas
    private current = rxResource({
        params: () => {
            const user = this.auth.user();
            return user && user.role !== "owner" ? user.id : undefined;
        },
        stream: () => this.getSettings(),
    });

    shopName = computed(() => (this.current.hasValue() ? this.current.value().name : ""));
    shopLogo = computed(() => (this.current.hasValue() ? this.current.value().logo : null));

    // indicatif des numéros saisis sans "+" : une seule source pour WhatsApp, l'appel et l'affichage
    defaultCountryCode = computed(() =>
        this.current.hasValue()
            ? (this.current.value().default_country_code ?? DEFAULT_COUNTRY_CODE)
            : DEFAULT_COUNTRY_CODE,
    );

    getSettings() {
        return this.http.get<ShopSettings>(`${API_URL}/shop-settings`);
    }

    updateSettings(input: ShopSettingsInput) {
        return this.http
            .put<ShopSettings>(`${API_URL}/shop-settings`, input)
            .pipe(tap((settings) => this.current.set(settings)));
    }

    updateLogo(logo: string) {
        return this.http
            .put<ShopSettings>(`${API_URL}/shop-settings/logo`, { logo })
            .pipe(tap((settings) => this.current.set(settings)));
    }

    removeLogo() {
        return this.http
            .delete<ShopSettings>(`${API_URL}/shop-settings/logo`)
            .pipe(tap((settings) => this.current.set(settings)));
    }
}

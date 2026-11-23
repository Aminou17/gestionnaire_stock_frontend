import { HttpClient } from "@angular/common/http";
import { Injectable, computed, effect, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { ModuleStore } from "../modules/module-access";
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
    // fin de l'essai gratuit, pour la page Abonnement
    trialEndsAt = computed(() =>
        this.current.hasValue() ? (this.current.value().trial_ends_at ?? null) : null,
    );
    private modules = inject(ModuleStore);

    constructor() {
        // les accès de la boutique sont publiés pour les menus et les gardes, sans qu'ils dépendent de ce service
        effect(() => {
            if (this.current.hasValue()) {
                const settings = this.current.value();
                this.modules.disabled.set(settings.disabled_modules ?? []);
                this.modules.subscriptions.set(settings.subscriptions_enabled ?? false);
                this.modules.ready.set(true);
            } else if (this.current.error() !== undefined) {
                this.modules.ready.set(true);
            } else if (this.current.status() === "idle") {
                this.modules.disabled.set([]);
                this.modules.subscriptions.set(false);
                this.modules.ready.set(false);
            }
        });
    }

    subscriptionsEnabled = computed(() =>
        this.current.hasValue() ? (this.current.value().subscriptions_enabled ?? false) : false,
    );
    disabledModules = computed(() =>
        this.current.hasValue() ? (this.current.value().disabled_modules ?? []) : [],
    );
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

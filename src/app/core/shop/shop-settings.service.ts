import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { ShopSettings, ShopSettingsInput } from "./shop-settings.model";

@Injectable({ providedIn: "root" })
export class ShopSettingsService {
    private http = inject(HttpClient);

    getSettings() {
        return this.http.get<ShopSettings>(`${API_URL}/shop-settings`);
    }

    updateSettings(input: ShopSettingsInput) {
        return this.http.put<ShopSettings>(`${API_URL}/shop-settings`, input);
    }

    updateLogo(logo: string) {
        return this.http.put<ShopSettings>(`${API_URL}/shop-settings/logo`, { logo });
    }

    removeLogo() {
        return this.http.delete<ShopSettings>(`${API_URL}/shop-settings/logo`);
    }
}

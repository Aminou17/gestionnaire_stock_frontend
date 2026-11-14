import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";

export interface CashSettings {
    // l'employé clôture sans connaître le solde attendu
    blind_close: boolean;
    updated_at: string | null;
}

@Injectable({ providedIn: "root" })
export class CashSettingsService {
    private http = inject(HttpClient);

    getSettings() {
        return this.http.get<CashSettings>(`${API_URL}/cash-settings`);
    }

    updateSettings(blindClose: boolean) {
        return this.http.put<CashSettings>(`${API_URL}/cash-settings`, { blindClose });
    }
}

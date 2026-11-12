import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { SalesSettings, SalesSettingsInput } from "./sales-settings.model";

@Injectable({ providedIn: "root" })
export class SalesSettingsService {
    private http = inject(HttpClient);

    getSettings() {
        return this.http.get<SalesSettings>(`${API_URL}/sales-settings`);
    }

    updateSettings(input: SalesSettingsInput) {
        return this.http.put<SalesSettings>(`${API_URL}/sales-settings`, input);
    }
}

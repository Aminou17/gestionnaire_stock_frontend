import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { AlertEmailInput, AlertEmailSettings } from "./alert-email.model";

@Injectable({ providedIn: "root" })
export class AlertEmailService {
    private http = inject(HttpClient);

    getSettings() {
        return this.http.get<AlertEmailSettings>(`${API_URL}/alert-email/settings`);
    }

    updateSettings(input: AlertEmailInput) {
        return this.http.put<AlertEmailSettings>(`${API_URL}/alert-email/settings`, input);
    }

    sendTest() {
        return this.http.post<{ sent: boolean; alertCount: number }>(
            `${API_URL}/alert-email/test`,
            {},
        );
    }
}

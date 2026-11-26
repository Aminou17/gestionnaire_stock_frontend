import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../core/api.config";

export interface MailSettings {
    gmailUser: string | null;
    hasPassword: boolean;
    unreadable: boolean;
    updatedAt: string | null;
    // D'où vient le compte qui envoie en ce moment
    activeSource: "database" | "env" | "none";
}

@Injectable({ providedIn: "root" })
export class MailSettingsService {
    private http = inject(HttpClient);

    get() {
        return this.http.get<MailSettings>(`${API_URL}/mail-settings`);
    }

    save(gmailUser: string, gmailPassword: string) {
        return this.http.put<MailSettings>(`${API_URL}/mail-settings`, {
            gmailUser,
            ...(gmailPassword ? { gmailPassword } : {}),
        });
    }

    remove() {
        return this.http.delete<MailSettings>(`${API_URL}/mail-settings`);
    }

    sendTest() {
        return this.http.post<{ message: string }>(`${API_URL}/mail-settings/test`, {});
    }
}

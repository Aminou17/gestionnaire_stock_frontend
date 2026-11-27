import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import {
    AnnouncementInput,
    OwnerAnnouncement,
    OwnerAnnouncementDetail,
    ShopAnnouncement,
    ShopHistoryEntry,
} from "./announcement.model";

@Injectable({ providedIn: "root" })
export class AnnouncementService {
    private http = inject(HttpClient);
    private base = `${API_URL}/announcements`;

    // Messages de la boutique pas encore lus
    unread = signal(0);

    // Demander le nombre vaut aussi accusé de réception côté serveur
    refreshUnread() {
        this.http
            .get<{ unread: number }>(`${this.base}/unread`)
            .subscribe({ next: (res) => this.unread.set(res.unread), error: () => {} });
    }

    getMine() {
        return this.http.get<ShopAnnouncement[]>(this.base);
    }

    // Ouvrir un message le marque lu
    open(id: number) {
        return this.http
            .get<ShopAnnouncement>(`${this.base}/${id}`)
            .pipe(tap(() => this.refreshUnread()));
    }

    reply(id: number, message: string) {
        return this.http.post<{ threadId: number }>(`${this.base}/${id}/reply`, { message });
    }

    // Propriétaire

    getSent() {
        return this.http.get<OwnerAnnouncement[]>(`${this.base}/owner`);
    }

    getOne(id: number) {
        return this.http.get<OwnerAnnouncementDetail>(`${this.base}/owner/${id}`);
    }

    getShopHistory(shopId: number) {
        return this.http.get<ShopHistoryEntry[]>(`${this.base}/owner/shops/${shopId}`);
    }

    save(input: AnnouncementInput, id: number | null = null) {
        const url = `${this.base}/owner`;
        return id
            ? this.http.put<{ id: number; recipients: number }>(`${url}/${id}`, input)
            : this.http.post<{ id: number; recipients: number }>(url, input);
    }

    cancel(id: number) {
        return this.http.delete<void>(`${this.base}/owner/${id}`);
    }
}

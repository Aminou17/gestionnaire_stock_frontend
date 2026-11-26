import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import {
    SupportMessage,
    SupportSide,
    SupportThread,
    SupportThreadDetail,
    ThreadStatus,
} from "./support.model";

@Injectable({ providedIn: "root" })
export class SupportService {
    private http = inject(HttpClient);

    // Conversations avec une réponse (ou un message pour le propriétaire) pas encore lue
    unread = signal(0);

    // Le propriétaire passe par /support/owner, les utilisateurs par /support
    private base(side: SupportSide) {
        return side === "owner" ? `${API_URL}/support/owner` : `${API_URL}/support`;
    }

    refreshUnread(side: SupportSide) {
        this.http
            .get<{ unread: number }>(`${this.base(side)}/unread`)
            .subscribe({ next: (res) => this.unread.set(res.unread), error: () => {} });
    }

    getThreads(side: SupportSide) {
        return this.http.get<SupportThread[]>(`${this.base(side)}/threads`);
    }

    // Ouvrir une conversation la marque lue
    getThread(side: SupportSide, id: number) {
        return this.http
            .get<SupportThreadDetail>(`${this.base(side)}/threads/${id}`)
            .pipe(tap(() => this.refreshUnread(side)));
    }

    createThread(subject: string, message: string) {
        return this.http.post<SupportThread>(`${API_URL}/support/threads`, { subject, message });
    }

    sendMessage(side: SupportSide, id: number, message: string) {
        return this.http.post<SupportMessage>(`${this.base(side)}/threads/${id}/messages`, {
            message,
        });
    }

    setStatus(id: number, status: ThreadStatus) {
        return this.http.patch<{ id: number; status: ThreadStatus }>(
            `${API_URL}/support/owner/threads/${id}/status`,
            { status },
        );
    }
}

import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";

import { API_URL } from "../api.config";
import { HelpRequest, HelpRequestInput } from "./help.model";

@Injectable({ providedIn: "root" })
export class HelpService {
    private http = inject(HttpClient);

    // Demandes sans réponse, pour la pastille du propriétaire
    open = signal(0);

    // page publique : aucune connexion nécessaire
    send(input: HelpRequestInput) {
        return this.http.post<{ message: string }>(`${API_URL}/help`, input);
    }

    refreshOpen() {
        this.http
            .get<{ open: number }>(`${API_URL}/help/count`)
            .subscribe({ next: (res) => this.open.set(res.open), error: () => {} });
    }

    getRequests(status: "OPEN" | "CLOSED") {
        return this.http.get<HelpRequest[]>(`${API_URL}/help`, { params: { status } });
    }

    reply(id: number, reply: string) {
        return this.http.post<HelpRequest>(`${API_URL}/help/${id}/reply`, { reply });
    }

    setStatus(id: number, status: "OPEN" | "CLOSED") {
        return this.http.patch<HelpRequest>(`${API_URL}/help/${id}/status`, { status });
    }
}

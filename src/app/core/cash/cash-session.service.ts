import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import {
    CashMovement,
    CashSession,
    CashSessionDetail,
    CashSessionPage,
    CashToday,
} from "./cash.model";

// open : caisses du jour en cours, uncounted : jamais comptées, gap : comptées avec un écart
export interface CashSessionFilters {
    from?: string | null;
    to?: string | null;
    status?: "open" | "uncounted" | "gap" | null;
}

// PostgreSQL renvoie les montants en texte ("1500.00")
const toNumber = (value: string | number | null | undefined) =>
    value === null || value === undefined ? null : Number(value);

const toSession = <T extends CashSession>(session: T): T => ({
    ...session,
    opening_amount: toNumber(session.opening_amount),
    theoretical_amount: toNumber(session.theoretical_amount),
    actual_amount: toNumber(session.actual_amount),
    difference: toNumber(session.difference),
});

const toMovement = (movement: CashMovement): CashMovement => ({
    ...movement,
    amount: Number(movement.amount),
});

@Injectable({ providedIn: "root" })
export class CashSessionService {
    private http = inject(HttpClient);

    // Compte la caisse : sans sessionId, celle du jour (le serveur l'ouvre si besoin)
    // sessionId : une caisse passée non comptée, ou une caisse à rectifier (admin)
    // le serveur renvoie la session comptée, avec l'écart (compté moins attendu)
    count(actualAmount: number, closingNote = "", sessionId?: number) {
        const note = closingNote.trim();

        return this.http
            .post<CashSession>(`${API_URL}/cash_sessions/close`, {
                actualAmount,
                ...(note ? { closingNote: note } : {}),
                ...(sessionId ? { sessionId } : {}),
            })
            .pipe(map(toSession));
    }

    // État de la caisse du jour, caisse non comptée d'un jour passé et fond de départ
    getToday() {
        return this.http.get<CashToday>(`${API_URL}/dashboard/summary`);
    }

    getSessions(page: number, limit: number, filters: CashSessionFilters = {}) {
        return this.http
            .get<CashSessionPage>(`${API_URL}/cash_sessions`, {
                params: { page, limit, ...this.filterParams(filters) },
            })
            .pipe(map((res) => ({ ...res, data: res.data.map(toSession) })));
    }

    // Fichier de l'historique selon les mêmes filtres
    exportSessions(filters: CashSessionFilters, format: ExportFormat) {
        return this.http.get(`${API_URL}/cash_sessions/export`, {
            params: { ...this.filterParams(filters), format },
            responseType: "blob",
        });
    }

    private filterParams(filters: CashSessionFilters) {
        const params: Record<string, string> = {};
        if (filters.from) params["startDate"] = filters.from;
        if (filters.to) params["endDate"] = filters.to;
        if (filters.status) params["status"] = filters.status;
        return params;
    }

    getSession(id: number) {
        return this.http.get<CashSessionDetail>(`${API_URL}/cash_sessions/${id}`).pipe(
            map((session) => ({
                ...toSession(session),
                movements: session.movements.map(toMovement),
            })),
        );
    }
}

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
    ClosedCash,
} from "./cash.model";

// open : caisses encore ouvertes, gap : caisses clôturées avec un écart
export interface CashSessionFilters {
    from?: string | null;
    to?: string | null;
    status?: "open" | "gap" | null;
}

export interface TodayCash {
    status: "OPEN" | "CLOSED";
    balance: number;
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

    // la date de la session est fixée par le serveur (jour courant)
    open(openingAmount: number) {
        return this.http.post(`${API_URL}/cash_sessions/open`, { openingAmount });
    }

    // sessionDate : YYYY-MM-DD de la session à clôturer (celle du jour, ou une oubliée)
    // closingNote : obligatoire quand le montant compté diffère du solde attendu
    // sessionId : seulement pour l'admin qui ferme la caisse oubliée d'un autre
    close(sessionDate: string, actualAmount: number, closingNote = "", sessionId?: number) {
        return this.http
            .post<ClosedCash>(`${API_URL}/cash_sessions/close`, {
                sessionDate,
                actualAmount,
                closingNote,
                ...(sessionId ? { sessionId } : {}),
            })
            .pipe(map((res) => ({ ...res, difference: Number(res.difference) })));
    }

    // explication d'un écart découvert après une clôture à l'aveugle
    addClosingNote(id: number, closingNote: string) {
        return this.http.post(`${API_URL}/cash_sessions/${id}/closing-note`, { closingNote });
    }

    getTodayCash() {
        return this.getToday().pipe(map((res) => res.cash));
    }

    // session du jour et session oubliée ouverte, calculées par le serveur avec sa date
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

    // fichier de l'historique selon les mêmes filtres
    exportSessions(filters: CashSessionFilters, format: ExportFormat) {
        return this.http.get(`${API_URL}/cash_sessions/export`, {
            params: { ...this.filterParams(filters), format },
            responseType: "blob",
        });
    }

    // admin seulement : rouvre une caisse clôturée, le motif reste dans le journal
    reopen(id: number, reason: string) {
        return this.http.post(`${API_URL}/cash_sessions/${id}/reopen`, { reason });
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

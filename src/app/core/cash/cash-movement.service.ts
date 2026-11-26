import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { ExportFormat } from "../export-format";
import {
    CashMovementDetail,
    CashMovementFilters,
    CashMovementPage,
    ExpenseSummary,
    ManualMovementType,
} from "./cash.model";

@Injectable({ providedIn: "root" })
export class CashMovementService {
    private http = inject(HttpClient);

    // Category vient de CASH_REASONS et reste facultatif ; reason est toujours obligatoire
    create(
        type: ManualMovementType,
        amount: number,
        category: string,
        reason: string,
        receipt: string | null = null,
    ) {
        return this.http.post(`${API_URL}/cash_movements`, {
            type,
            amount,
            reason,
            ...(category ? { category } : {}),
            ...(receipt ? { receipt } : {}),
        });
    }

    // L'argent revient dans le tiroir ; la ligne reste, marquée annulée
    cancelExpense(id: number) {
        return this.http.post(`${API_URL}/cash_movements/${id}/cancel`, {});
    }

    exportExpenses(
        filters: Omit<CashMovementFilters, "page" | "limit" | "type">,
        format: ExportFormat,
    ) {
        const params: Record<string, string> = { format };
        if (filters.from) params["from"] = filters.from;
        if (filters.to) params["to"] = filters.to;
        if (filters.category) params["category"] = filters.category;
        if (filters.search) params["search"] = filters.search;

        return this.http.get(`${API_URL}/cash_movements/expenses/export`, {
            params,
            responseType: "blob",
        });
    }

    getMovements(filters: CashMovementFilters) {
        const params: Record<string, string | number> = {
            page: filters.page,
            limit: filters.limit,
        };

        if (filters.type) params["type"] = filters.type;
        if (filters.from) params["from"] = filters.from;
        if (filters.to) params["to"] = filters.to;
        if (filters.category) params["category"] = filters.category;
        if (filters.search) params["search"] = filters.search;

        return this.http.get<CashMovementPage>(`${API_URL}/cash_movements`, { params }).pipe(
            // PostgreSQL renvoie les montants en texte ("1500.00")
            map((res) => ({
                ...res,
                data: res.data.map((movement) => ({
                    ...movement,
                    amount: Number(movement.amount),
                })),
            })),
        );
    }

    // Dépenses d'une période, au total et par motif
    getExpenseSummary(from: string | null, to: string | null) {
        const params: Record<string, string> = {};
        if (from) params["from"] = from;
        if (to) params["to"] = to;

        return this.http.get<ExpenseSummary>(`${API_URL}/cash_movements/expenses/summary`, {
            params,
        });
    }

    getMovement(id: number) {
        return this.http
            .get<CashMovementDetail>(`${API_URL}/cash_movements/${id}`)
            .pipe(map((movement) => ({ ...movement, amount: Number(movement.amount) })));
    }
}

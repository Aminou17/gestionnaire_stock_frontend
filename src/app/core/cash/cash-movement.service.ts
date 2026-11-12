import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { CashMovementFilters, CashMovementPage, ManualMovementType } from "./cash.model";

@Injectable({ providedIn: "root" })
export class CashMovementService {
    private http = inject(HttpClient);

    // category vient de CASH_REASONS et reste facultatif ; reason est toujours obligatoire
    create(type: ManualMovementType, amount: number, category: string, reason: string) {
        return this.http.post(`${API_URL}/cash_movements`, {
            type,
            amount,
            reason,
            ...(category ? { category } : {}),
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
}

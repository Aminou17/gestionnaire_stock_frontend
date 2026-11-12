import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { NewSaleItem, Sale, SaleDetail, SaleFilters, SalePage, NewSalePayment } from "./sale.model";

// PostgreSQL renvoie les montants en texte ("1500.00")
const toSale = <T extends Sale | SaleDetail>(sale: T): T => ({
    ...sale,
    total: Number(sale.total),
});

@Injectable({ providedIn: "root" })
export class SaleService {
    private http = inject(HttpClient);

    getSales(limit?: number) {
        const params: Record<string, number> = limit ? { limit } : {};
        return this.http
            .get<Sale[]>(`${API_URL}/sales`, { params })
            .pipe(map((sales) => sales.map(toSale)));
    }

    getSalesPage(filters: SaleFilters) {
        const params: Record<string, string | number> = {
            page: filters.page,
            limit: filters.limit,
            includeSummary: "true",
        };

        if (filters.status) params["status"] = filters.status;
        if (filters.from) params["from"] = filters.from;
        if (filters.to) params["to"] = filters.to;

        return this.http
            .get<SalePage>(`${API_URL}/sales`, { params })
            .pipe(map((res) => ({ ...res, data: res.data.map(toSale) })));
    }

    getSale(id: number) {
        return this.http.get<SaleDetail>(`${API_URL}/sales/${id}`).pipe(
            map((sale) => ({
                ...toSale(sale),
                items: sale.items.map((item) => ({
                    ...item,
                    unit_price: Number(item.unit_price),
                    reference_price: Number(item.reference_price),
                    discount_amount: Number(item.discount_amount),
                })),
                // un backend plus ancien n'envoie pas ces champs
                payment_method: sale.payment_method ?? "CASH",
                amount_received:
                    sale.amount_received === null || sale.amount_received === undefined
                        ? null
                        : Number(sale.amount_received),
                payment_reference: sale.payment_reference ?? null,
                movements: sale.movements ?? [],
                previous_id: sale.previous_id ?? null,
                next_id: sale.next_id ?? null,
            })),
        );
    }

    createSale(items: NewSaleItem[], payment: NewSalePayment = { paymentMethod: "CASH" }) {
        return this.http.post<{ id: number }>(`${API_URL}/sales`, { items, ...payment });
    }

    cancelSale(id: number, reason: string) {
        return this.http.post<{ message: string }>(`${API_URL}/sales/${id}/cancel`, { reason });
    }
}

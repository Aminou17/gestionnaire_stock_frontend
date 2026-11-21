import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../api.config";
import { NewSaleItem, Sale, SaleDetail, SaleFilters, SalePage, NewSalePayment } from "./sale.model";

// PostgreSQL renvoie les montants en texte ("1500.00")
const toSale = <T extends Sale | SaleDetail>(sale: T): T => ({
    ...sale,
    total: Number(sale.total),
    // un backend plus ancien n'envoie pas ces champs : la vente était payée en totalité
    paid_amount: sale.paid_amount === undefined ? Number(sale.total) : Number(sale.paid_amount),
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
        if (filters.paymentMethod) params["paymentMethod"] = filters.paymentMethod;
        if (filters.sellerId) params["sellerId"] = filters.sellerId;
        if (filters.unpaid) params["unpaid"] = "true";
        if (filters.search?.trim()) params["search"] = filters.search.trim();

        return this.http
            .get<SalePage>(`${API_URL}/sales`, { params })
            .pipe(map((res) => ({ ...res, data: res.data.map(toSale) })));
    }

    // adresse publique du ticket, que le client ouvre depuis WhatsApp sans se connecter
    getTicketLink(id: number) {
        return this.http.post<{ url: string }>(`${API_URL}/tickets/sales/${id}/link`, {});
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
                payments: (sale.payments ?? []).map((payment) => ({
                    ...payment,
                    amount: Number(payment.amount),
                    amount_received:
                        payment.amount_received === null ? null : Number(payment.amount_received),
                })),
                returns: (sale.returns ?? []).map((row) => ({
                    ...row,
                    amount: Number(row.amount),
                    cash_refunded: Number(row.cash_refunded),
                    other_refunded: Number(row.other_refunded),
                })),
                returned_amount: Number(sale.returned_amount ?? 0),
                movements: sale.movements ?? [],
                previous_id: sale.previous_id ?? null,
                next_id: sale.next_id ?? null,
            })),
        );
    }

    createSale(items: NewSaleItem[], payment: NewSalePayment = { paymentMethod: "CASH" }) {
        return this.http.post<{ id: number }>(`${API_URL}/sales`, { items, ...payment });
    }

    // encaisser un acompte ou le solde d'une vente
    addPayment(id: number, payment: NewSalePayment & { amountPaid: number }) {
        return this.http.post<{ id: number }>(`${API_URL}/sales/${id}/payments`, payment);
    }

    // rendre une partie d'un article : le stock est remis et le client remboursé
    returnItem(id: number, body: { productId: number; quantity: number; reason: string }) {
        return this.http.post<{ amount: number; cashRefunded: number; otherRefunded: number }>(
            `${API_URL}/sales/${id}/returns`,
            body,
        );
    }

    cancelSale(id: number, reason: string) {
        return this.http.post<{ message: string }>(`${API_URL}/sales/${id}/cancel`, { reason });
    }
}

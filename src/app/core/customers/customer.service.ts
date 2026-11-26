import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { NewSalePayment } from "../sales/sale.model";
import {
    Customer,
    CustomerFilters,
    CustomerInput,
    CustomerPage,
    CustomerPayment,
    CustomerPaymentRecord,
    CustomerSale,
    Paged,
} from "./customer.model";

// Clients : ouverts à l'administrateur et à l'employé, la désactivation à l'administrateur
@Injectable({ providedIn: "root" })
export class CustomerService {
    private http = inject(HttpClient);

    getCustomers(filters: Partial<CustomerFilters> = {}) {
        const params: Record<string, string | number> = {};

        const search = filters.search?.trim();
        if (search) params["search"] = search;
        if (filters.status && filters.status !== "active") params["status"] = filters.status;
        if (filters.unpaid) params["unpaid"] = "true";
        if (filters.sort && filters.sort !== "recent") params["sort"] = filters.sort;
        if (filters.page) params["page"] = filters.page;
        if (filters.limit) params["limit"] = filters.limit;

        return this.http.get<CustomerPage>(`${API_URL}/customers`, { params });
    }

    getCustomer(id: number) {
        return this.http.get<Customer>(`${API_URL}/customers/${id}`);
    }

    getCustomerSales(id: number, page = 1, limit = 20) {
        return this.http.get<Paged<CustomerSale>>(`${API_URL}/customers/${id}/sales`, {
            params: { page, limit },
        });
    }

    // Adresse publique du ticket d'un paiement, à joindre au message WhatsApp
    getPaymentTicketLink(paymentId: number) {
        return this.http.post<{ url: string }>(
            `${API_URL}/tickets/customer-payments/${paymentId}/link`,
            {},
        );
    }

    getCustomerPayments(id: number, limit = 5) {
        return this.http.get<Paged<CustomerPaymentRecord>>(`${API_URL}/customers/${id}/payments`, {
            params: { page: 1, limit },
        });
    }

    createCustomer(input: CustomerInput) {
        return this.http.post<Customer>(`${API_URL}/customers`, input);
    }

    updateCustomer(id: number, input: CustomerInput) {
        return this.http.put<Customer>(`${API_URL}/customers/${id}`, input);
    }

    // Un seul paiement, réparti par le serveur sur les ventes impayées, les plus anciennes d'abord
    payCustomer(id: number, payment: NewSalePayment & { amountPaid: number }) {
        return this.http.post<CustomerPayment>(`${API_URL}/customers/${id}/payments`, payment);
    }

    deleteCustomer(id: number) {
        return this.http.delete<{ message: string; customer: Customer }>(
            `${API_URL}/customers/${id}`,
        );
    }

    restoreCustomer(id: number) {
        return this.http.patch<Customer>(`${API_URL}/customers/${id}/restore`, {});
    }
}

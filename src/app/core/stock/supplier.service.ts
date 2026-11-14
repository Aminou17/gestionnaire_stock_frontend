import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { Supplier, SupplierInput, SupplierStatus } from "./supplier.model";

// Fournisseurs : réservés à l'administrateur, côté backend comme côté interface
@Injectable({ providedIn: "root" })
export class SupplierService {
    private http = inject(HttpClient);

    getSuppliers(status: SupplierStatus = "active") {
        if (status === "active") {
            return this.http.get<Supplier[]>(`${API_URL}/suppliers`);
        }
        return this.http.get<Supplier[]>(`${API_URL}/suppliers`, { params: { status } });
    }

    getSupplier(id: number) {
        return this.http.get<Supplier>(`${API_URL}/suppliers/${id}`);
    }

    createSupplier(input: SupplierInput) {
        return this.http.post<Supplier>(`${API_URL}/suppliers`, input);
    }

    updateSupplier(id: number, input: SupplierInput) {
        return this.http.put<Supplier>(`${API_URL}/suppliers/${id}`, input);
    }

    deleteSupplier(id: number) {
        return this.http.delete<{ message: string }>(`${API_URL}/suppliers/${id}`);
    }

    restoreSupplier(id: number) {
        return this.http.patch<Supplier>(`${API_URL}/suppliers/${id}/restore`, {});
    }
}

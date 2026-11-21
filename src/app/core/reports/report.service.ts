import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { Balance, BalanceQuery } from "./report.model";

@Injectable({ providedIn: "root" })
export class ReportService {
    private http = inject(HttpClient);

    getBalance(query: BalanceQuery) {
        const params = new HttpParams()
            .set("date", query.date)
            .set("from", query.from)
            .set("to", query.to);

        return this.http.get<Balance>(`${API_URL}/reports/balance`, { params });
    }
}

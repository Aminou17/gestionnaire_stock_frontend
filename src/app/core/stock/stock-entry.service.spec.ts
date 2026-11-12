import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { StockEntryService } from "./stock-entry.service";
import { API_URL } from "../api.config";

describe("StockEntryService", () => {
    let service: StockEntryService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(StockEntryService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should ask a page with the totals and only the filters set", () => {
        service
            .getEntries({ from: "2026-11-01", to: null, supplierId: 2, page: 1, limit: 20 })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/stock_entries`);
        expect(req.request.params.get("includeSummary")).toBe("true");
        expect(req.request.params.get("from")).toBe("2026-11-01");
        expect(req.request.params.has("to")).toBe(false);
        expect(req.request.params.get("supplierId")).toBe("2");
        req.flush({
            data: [],
            total: 0,
            counters: { entries: 0, units: 0, products: 0, suppliers: 0 },
        });
    });

    it("should send a new entry", () => {
        service.createEntry({ productId: 3, supplierId: 1, quantity: 12 }).subscribe();

        const req = httpMock.expectOne(`${API_URL}/stock_entries`);
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ productId: 3, supplierId: 1, quantity: 12 });
        req.flush({ id: 12 });
    });
});

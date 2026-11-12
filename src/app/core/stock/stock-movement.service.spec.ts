import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { StockMovementService } from "./stock-movement.service";
import { API_URL } from "../api.config";

describe("StockMovementService", () => {
    let service: StockMovementService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(StockMovementService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should ask a page with the totals and the backend filter names", () => {
        service
            .getMovements({
                from: "2026-11-01",
                to: "2026-11-11",
                type: "SALE",
                productId: 3,
                page: 2,
                limit: 20,
            })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/stock_movements`);
        expect(req.request.params.get("includeSummary")).toBe("true");
        expect(req.request.params.get("startDate")).toBe("2026-11-01");
        expect(req.request.params.get("endDate")).toBe("2026-11-11");
        expect(req.request.params.get("type")).toBe("SALE");
        expect(req.request.params.get("productId")).toBe("3");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.get("limit")).toBe("20");
        req.flush({ data: [], total: 0, counters: {} });
    });

    it("should not send the filters left empty", () => {
        service
            .getMovements({ from: null, to: null, type: null, productId: null, page: 1, limit: 20 })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/stock_movements`);
        expect(req.request.params.keys().sort()).toEqual(["includeSummary", "limit", "page"]);
        req.flush({ data: [], total: 0, counters: {} });
    });

    it("should download the csv with the same filters and no pagination", () => {
        service
            .exportCsv({ from: "2026-11-01", to: null, type: "ENTRY", productId: null })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/stock_movements/export`);
        expect(req.request.responseType).toBe("blob");
        expect(req.request.params.keys().sort()).toEqual(["startDate", "type"]);
        req.flush(new Blob(["a"]));
    });
});

import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { CashMovementService } from "./cash-movement.service";

describe("CashMovementService", () => {
    let service: CashMovementService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(CashMovementService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should post the type and the amount of a manual movement", () => {
        service.create("EXPENSE", 2500, "SUPPLIES", "Achat de fil").subscribe();

        const req = httpMock.expectOne("/api/cash_movements");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({
            type: "EXPENSE",
            amount: 2500,
            category: "SUPPLIES",
            reason: "Achat de fil",
        });
        req.flush({ id: 1 });
    });

    it("should ask for a page of movements with the chosen filters and convert the amounts", () => {
        let result: unknown;
        service
            .getMovements({
                type: "EXPENSE",
                from: "2026-11-01",
                to: "2026-11-10",
                category: "TRANSPORT",
                page: 2,
                limit: 20,
            })
            .subscribe((res) => (result = res));

        const req = httpMock.expectOne((r) => r.url === "/api/cash_movements");
        expect(req.request.params.get("type")).toBe("EXPENSE");
        expect(req.request.params.get("from")).toBe("2026-11-01");
        expect(req.request.params.get("to")).toBe("2026-11-10");
        expect(req.request.params.get("category")).toBe("TRANSPORT");
        expect(req.request.params.get("page")).toBe("2");
        req.flush({
            data: [{ id: 1, type: "EXPENSE", amount: "2500.00" }],
            summary: { totalIn: 0, totalOut: 2500 },
            pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
        });

        expect(result).toMatchObject({ data: [{ amount: 2500 }], summary: { totalOut: 2500 } });
    });

    it("should not send empty filters", () => {
        service
            .getMovements({ type: null, from: null, to: null, category: null, page: 1, limit: 20 })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/cash_movements");
        expect(req.request.params.has("type")).toBe(false);
        expect(req.request.params.has("from")).toBe(false);
        req.flush({ data: [], summary: { totalIn: 0, totalOut: 0 }, pagination: {} });
    });
});

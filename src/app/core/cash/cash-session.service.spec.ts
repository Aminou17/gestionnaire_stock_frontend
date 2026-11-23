import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { CashSessionService } from "./cash-session.service";

describe("CashSessionService", () => {
    let service: CashSessionService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(CashSessionService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should count today's cash with the counted amount only", () => {
        service.count(61500).subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ actualAmount: 61500 });
        req.flush({});
    });

    it("should send the optional reason and the session to count", () => {
        service.count(61000, "  Erreur de monnaie ", 7).subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body).toEqual({
            actualAmount: 61000,
            closingNote: "Erreur de monnaie",
            sessionId: 7,
        });
        req.flush({});
    });

    it("should return the counted session with the gap as a number", () => {
        let result: unknown;
        service.count(11500).subscribe((res) => (result = res));

        httpMock.expectOne("/api/cash_sessions/close").flush({
            id: 3,
            status: "CLOSED",
            theoretical_amount: "12000.00",
            actual_amount: "11500.00",
            difference: "-500.00",
        });

        expect(result).toMatchObject({
            status: "CLOSED",
            theoretical_amount: 12000,
            actual_amount: 11500,
            difference: -500,
        });
    });

    it("should send the period and the status filters of the history", () => {
        service
            .getSessions(1, 20, { from: "2026-11-01", to: "2026-11-12", status: "gap" })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/cash_sessions");
        expect(req.request.params.get("startDate")).toBe("2026-11-01");
        expect(req.request.params.get("endDate")).toBe("2026-11-12");
        expect(req.request.params.get("status")).toBe("gap");
        req.flush({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    });

    it("should filter the history on uncounted sessions", () => {
        service.getSessions(1, 20, { status: "uncounted" }).subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/cash_sessions");
        expect(req.request.params.get("status")).toBe("uncounted");
        req.flush({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    });

    it("should convert the amounts of a session list to numbers", () => {
        let result: unknown;
        service.getSessions(2, 20).subscribe((res) => (result = res));

        const req = httpMock.expectOne((r) => r.url === "/api/cash_sessions");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.get("limit")).toBe("20");
        req.flush({
            data: [
                {
                    id: 3,
                    session_date: "2026-11-10",
                    status: "OPEN",
                    opening_amount: "5000.00",
                    theoretical_amount: null,
                    actual_amount: null,
                    difference: null,
                },
                {
                    id: 2,
                    session_date: "2026-11-09",
                    status: "CLOSED",
                    opening_amount: "5000.00",
                    theoretical_amount: "12000.00",
                    actual_amount: "11500.00",
                    difference: "-500.00",
                },
            ],
            pagination: { page: 2, limit: 20, total: 22, totalPages: 2 },
        });

        const { data } = result as { data: Record<string, unknown>[] };
        expect(data[0]).toMatchObject({ opening_amount: 5000, difference: null });
        expect(data[1]).toMatchObject({
            theoretical_amount: 12000,
            actual_amount: 11500,
            difference: -500,
        });
    });

    it("should convert the amounts of a session and its movements to numbers", () => {
        let result: unknown;
        service.getSession(3).subscribe((res) => (result = res));

        httpMock.expectOne("/api/cash_sessions/3").flush({
            id: 3,
            session_date: "2026-11-10",
            status: "OPEN",
            opening_amount: "5000.00",
            theoretical_amount: null,
            actual_amount: null,
            difference: null,
            movements: [{ id: 1, type: "SALE", amount: "3000.00", reference_type: "sale" }],
        });

        expect(result).toMatchObject({
            opening_amount: 5000,
            movements: [{ amount: 3000 }],
        });
    });

    it("should read today's cash, the uncounted session and the opening amount", () => {
        let today: unknown;
        service.getToday().subscribe((res) => (today = res));

        const uncounted = { id: 5, sessionDate: "2026-11-22", balance: 9000, count: 1 };
        httpMock.expectOne("/api/dashboard/summary").flush({
            cash: null,
            uncountedSession: uncounted,
            expectedOpening: 9000,
            blindClose: false,
        });

        expect(today).toMatchObject({
            cash: null,
            uncountedSession: uncounted,
            expectedOpening: 9000,
        });
    });
});

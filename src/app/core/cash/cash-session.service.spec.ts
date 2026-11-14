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

    it("should open the cash register with the opening amount", () => {
        service.open(50000).subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/open");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ openingAmount: 50000 });
        req.flush({});
    });

    it("should close the session of the given date with the counted amount", () => {
        service.close("2026-11-10", 61500).subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({
            sessionDate: "2026-11-10",
            actualAmount: 61500,
            closingNote: "",
        });
        req.flush({});
    });

    it("should send the explanation of the gap when closing", () => {
        service.close("2026-11-10", 61000, "Erreur de monnaie").subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body.closingNote).toBe("Erreur de monnaie");
        req.flush({});
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

    it("should reopen a closed session with its reason", () => {
        service.reopen(4, "erreur de comptage").subscribe();

        const req = httpMock.expectOne("/api/cash_sessions/4/reopen");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ reason: "erreur de comptage" });
        req.flush({});
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

    it("should read today's cash from the dashboard summary", () => {
        let cash: unknown;
        service.getTodayCash().subscribe((res) => (cash = res));

        httpMock.expectOne("/api/dashboard/summary").flush({
            cash: { status: "OPEN", balance: 8000 },
            previousOpenSession: null,
            pendingExplanation: null,
            blindClose: false,
        });

        expect(cash).toEqual({ status: "OPEN", balance: 8000 });
    });
});

import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { ReportService } from "./report.service";

describe("ReportService", () => {
    let service: ReportService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(ReportService);
        http = TestBed.inject(HttpTestingController);
    });

    it("should send the date and the period to the balance route", () => {
        service
            .getBalance({ date: "2026-11-20", from: "2026-11-01", to: "2026-11-20" })
            .subscribe();

        const req = http.expectOne((r) => r.url === "/api/reports/balance");
        expect(req.request.params.get("date")).toBe("2026-11-20");
        expect(req.request.params.get("from")).toBe("2026-11-01");
        expect(req.request.params.get("to")).toBe("2026-11-20");
        req.flush({});
        http.verify();
    });
});

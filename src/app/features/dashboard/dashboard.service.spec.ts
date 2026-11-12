import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
    let service: DashboardService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(DashboardService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should let the backend choose the period and unwrap data", () => {
        let result: unknown;
        service.getDailySales().subscribe((data) => (result = data));

        const req = httpMock.expectOne((r) => r.url === "/api/dashboard/daily-sales");
        expect(req.request.params.keys()).toEqual([]);
        req.flush({ data: [{ date: "2026-11-11", netTotal: 1000 }], period: {} });

        expect(result).toEqual([{ date: "2026-11-11", netTotal: 1000 }]);
    });

    it("should request the recent activity with a limit", () => {
        service.getRecentActivity(5).subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/dashboard/recent-activity");
        expect(req.request.params.get("limit")).toBe("5");
        req.flush({ data: [] });
    });
});

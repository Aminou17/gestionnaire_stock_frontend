import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { AuditLogService } from "./audit-log.service";

describe("AuditLogService", () => {
    let service: AuditLogService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(AuditLogService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it("should send only the filters that are set, with the backend names", () => {
        service
            .getLogs({
                from: "2026-01-01",
                to: "2026-01-31",
                userId: 3,
                action: "SALE_CREATED",
                result: "FAILURE",
                page: 2,
                limit: 25,
            })
            .subscribe();

        const req = http.expectOne((r) => r.url === "/api/audit-logs");
        expect(req.request.params.get("startDate")).toBe("2026-01-01");
        expect(req.request.params.get("endDate")).toBe("2026-01-31");
        expect(req.request.params.get("userId")).toBe("3");
        expect(req.request.params.get("action")).toBe("SALE_CREATED");
        expect(req.request.params.get("result")).toBe("FAILURE");
        expect(req.request.params.get("page")).toBe("2");
        req.flush({ data: [], pagination: { page: 2, limit: 25, total: 0, totalPages: 0 } });
    });

    it("should leave out the empty filters", () => {
        service
            .getLogs({
                from: null,
                to: null,
                userId: null,
                action: null,
                result: null,
                page: 1,
                limit: 25,
            })
            .subscribe();

        const req = http.expectOne((r) => r.url === "/api/audit-logs");
        expect(req.request.params.keys().sort()).toEqual(["limit", "page"]);
        req.flush({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    });
});

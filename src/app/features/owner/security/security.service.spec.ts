import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { NO_FILTERS } from "./security.model";
import { SecurityService } from "./security.service";

describe("SecurityService", () => {
    let service: SecurityService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(SecurityService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should read the overview", () => {
        service.getOverview().subscribe();
        httpMock.expectOne("/api/security/overview").flush({});
    });

    it("should send only the filters that are filled in", () => {
        service
            .getList("failed-logins", {
                filters: { ...NO_FILTERS, shopId: 3, ip: "41.2", from: "2026-11-01" },
                extra: { view: "ip" },
                page: 2,
                limit: 25,
            })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/security/failed-logins");
        expect(req.request.params.get("view")).toBe("ip");
        expect(req.request.params.get("shopId")).toBe("3");
        expect(req.request.params.get("ip")).toBe("41.2");
        expect(req.request.params.get("startDate")).toBe("2026-11-01");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.has("email")).toBe(false);
        expect(req.request.params.has("endDate")).toBe(false);
        req.flush({ data: [], pagination: {} });
    });

    it("should ask for a csv file as a blob", () => {
        service.getCsv("locked-accounts", { filters: NO_FILTERS }).subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/security/locked-accounts");
        expect(req.request.params.get("format")).toBe("csv");
        expect(req.request.responseType).toBe("blob");
        req.flush(new Blob(["x"]));
    });
});

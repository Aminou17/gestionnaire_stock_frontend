import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { ExportService } from "./export.service";

describe("ExportService", () => {
    let service: ExportService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(ExportService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should download the products as a file", () => {
        service.productsCsv().subscribe();

        const req = httpMock.expectOne("/api/exports/products");
        expect(req.request.responseType).toBe("blob");
        req.flush(new Blob(["a"]));
    });

    it("should send the period only when it is set", () => {
        service.salesCsv("2026-11-01", "2026-11-12").subscribe();
        const withPeriod = httpMock.expectOne(
            (r) => r.url === "/api/exports/sales" && r.params.get("startDate") === "2026-11-01",
        );
        expect(withPeriod.request.params.get("endDate")).toBe("2026-11-12");
        withPeriod.flush(new Blob(["a"]));

        service.salesCsv(null, null).subscribe();
        const all = httpMock.expectOne("/api/exports/sales");
        expect(all.request.params.keys()).toEqual([]);
        all.flush(new Blob(["a"]));
    });
});

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
        service.productsFile("pdf").subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/exports/products");
        expect(req.request.params.get("format")).toBe("pdf");
        expect(req.request.responseType).toBe("blob");
        req.flush(new Blob(["a"]));
    });

    it("should send the period only when it is set", () => {
        service.salesFile("2026-11-01", "2026-11-12", "csv").subscribe();
        const withPeriod = httpMock.expectOne(
            (r) => r.url === "/api/exports/sales" && r.params.get("startDate") === "2026-11-01",
        );
        expect(withPeriod.request.params.get("endDate")).toBe("2026-11-12");
        expect(withPeriod.request.params.get("format")).toBe("csv");
        withPeriod.flush(new Blob(["a"]));

        service.salesFile(null, null, "pdf").subscribe();
        const all = httpMock.expectOne((r) => r.url === "/api/exports/sales");
        expect(all.request.params.keys()).toEqual(["format"]);
        all.flush(new Blob(["a"]));
    });
});

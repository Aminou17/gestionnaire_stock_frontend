import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { SalesSettingsService } from "./sales-settings.service";

describe("SalesSettingsService", () => {
    let service: SalesSettingsService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(SalesSettingsService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should read and save the sales settings", () => {
        service.getSettings().subscribe();
        httpMock.expectOne("/api/sales-settings").flush({ ticket_prefix: "" });

        const input = { ticketPrefix: "AB", defaultMaxDiscount: 500 };
        service.updateSettings(input).subscribe();
        const req = httpMock.expectOne("/api/sales-settings");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual(input);
        req.flush({ ticket_prefix: "AB" });
    });
});

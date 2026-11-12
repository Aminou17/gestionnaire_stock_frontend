import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { StockSettingsService } from "./stock-settings.service";

describe("StockSettingsService", () => {
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should load the default threshold", () => {
        let threshold: number | undefined;
        TestBed.inject(StockSettingsService)
            .getSettings()
            .subscribe((settings) => (threshold = settings?.min_stock));

        httpMock.expectOne("/api/stock-settings").flush({ id: 1, min_stock: 5 });
        expect(threshold).toBe(5);
    });
});

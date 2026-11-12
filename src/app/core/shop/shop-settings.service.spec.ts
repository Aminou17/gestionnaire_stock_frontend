import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { ShopSettingsService } from "./shop-settings.service";

describe("ShopSettingsService", () => {
    let service: ShopSettingsService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(ShopSettingsService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should read and save the shop settings", () => {
        service.getSettings().subscribe();
        httpMock.expectOne("/api/shop-settings").flush({ name: "Awa Bazin" });

        const input = {
            name: "Awa Bazin",
            address: "Marché Total",
            phone: "",
            taxId: "",
            rccm: "",
            receiptFooter: "",
        };
        service.updateSettings(input).subscribe();
        const req = httpMock.expectOne("/api/shop-settings");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual(input);
        req.flush({ name: "Awa Bazin" });
    });

    it("should send and remove the logo on its own route", () => {
        service.updateLogo("data:image/png;base64,AAAA").subscribe();
        const put = httpMock.expectOne("/api/shop-settings/logo");
        expect(put.request.method).toBe("PUT");
        expect(put.request.body).toEqual({ logo: "data:image/png;base64,AAAA" });
        put.flush({ name: "Awa Bazin" });

        service.removeLogo().subscribe();
        const del = httpMock.expectOne("/api/shop-settings/logo");
        expect(del.request.method).toBe("DELETE");
        del.flush({ name: "Awa Bazin" });
    });
});

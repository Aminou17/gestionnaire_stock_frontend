import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AuthService, User } from "../auth/auth.service";
import { ShopSettingsService } from "./shop-settings.service";

describe("ShopSettingsService", () => {
    let service: ShopSettingsService;
    let httpMock: HttpTestingController;
    const user = signal<User | null>(null);

    beforeEach(() => {
        user.set(null);
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { user } },
            ],
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

    it("should load the shop of the signed-in user and keep its name up to date", async () => {
        user.set({ id: 3, name: "Fatou", email: "f@x.com", role: "admin" });
        TestBed.tick();
        httpMock.expectOne("/api/shop-settings").flush({ name: "Chez Fatou", logo: null });
        await TestBed.inject(ApplicationRef).whenStable();
        expect(service.shopName()).toBe("Chez Fatou");

        service.updateLogo("data:image/png;base64,AAAA").subscribe();
        httpMock
            .expectOne("/api/shop-settings/logo")
            .flush({ name: "Chez Fatou", logo: "data:image/png;base64,AAAA" });
        expect(service.shopLogo()).toBe("data:image/png;base64,AAAA");
    });

    it("should not load any shop for the owner", () => {
        user.set({ id: 1, name: "Propriétaire", email: "p@x.com", role: "owner" });
        TestBed.tick();
        httpMock.expectNone("/api/shop-settings");
        expect(service.shopName()).toBe("");
    });
});

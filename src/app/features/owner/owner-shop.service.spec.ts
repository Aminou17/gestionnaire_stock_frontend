import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { OwnerShopService } from "./owner-shop.service";

describe("OwnerShopService", () => {
    let service: OwnerShopService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(OwnerShopService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should list, create and suspend shops on the owner routes", () => {
        service.getShops().subscribe();
        httpMock.expectOne("/api/shops").flush([]);

        const input = {
            shopName: "Chez Fatou",
            adminName: "Fatou",
            email: "f@x.com",
            password: "12345678",
        };
        service.createShop(input).subscribe();
        const create = httpMock.expectOne("/api/shops");
        expect(create.request.method).toBe("POST");
        expect(create.request.body).toEqual(input);
        create.flush({});

        service.setStatus(3, "SUSPENDED").subscribe();
        const status = httpMock.expectOne("/api/shops/3/status");
        expect(status.request.method).toBe("PATCH");
        expect(status.request.body).toEqual({ status: "SUSPENDED" });
        status.flush({});
    });

    it("should patch the trial of a shop with trialDays", () => {
        service.setTrial(3, 30).subscribe();
        const trial = httpMock.expectOne("/api/shops/3/trial");
        expect(trial.request.method).toBe("PATCH");
        expect(trial.request.body).toEqual({ trialDays: 30 });
        trial.flush({});

        service.setTrial(3, null).subscribe();
        const removed = httpMock.expectOne("/api/shops/3/trial");
        expect(removed.request.body).toEqual({ trialDays: null });
        removed.flush({});
    });
});

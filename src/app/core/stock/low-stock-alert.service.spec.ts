import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";

import { LowStockAlertService } from "./low-stock-alert.service";
import { AuthService } from "../auth/auth.service";

describe("LowStockAlertService", () => {
    let httpMock: HttpTestingController;

    function setup(role: "admin" | "manager") {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(role === "admin"), user: signal({ id: 1, role }) },
                },
            ],
        });
        httpMock = TestBed.inject(HttpTestingController);
        return TestBed.inject(LowStockAlertService);
    }

    afterEach(() => httpMock.verify());

    it("should load the alerts for an admin and expose the count", async () => {
        const service = setup("admin");
        TestBed.tick();

        httpMock.expectOne("/api/low-stock-alerts").flush([
            { id: 1, name: "Bazin riche", theoretical_stock: 0, min_stock: 5 },
            { id: 2, name: "Bazin brodé", theoretical_stock: 2, min_stock: 5 },
        ]);
        await TestBed.inject(LowStockAlertService).alerts.value;
        TestBed.tick();

        expect(service.count()).toBe(2);
    });

    it("should never call the admin-only route for a manager", () => {
        const service = setup("manager");
        TestBed.tick();

        httpMock.expectNone("/api/low-stock-alerts");
        expect(service.count()).toBe(0);
    });
});

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
            {
                id: 1,
                name: "Bazin riche",
                theoretical_stock: 0,
                min_stock: 5,
                sold_last_30_days: 0,
                days_left: null,
                category_id: null,
                category_name: null,
                supplier_id: null,
                supplier_name: null,
                supplier_contact: null,
                supplier_phone: null,
                last_entry_at: null,
                last_entry_quantity: null,
                status: "OUT_OF_STOCK",
            },
            {
                id: 2,
                name: "Bazin brodé",
                theoretical_stock: 2,
                min_stock: 5,
                sold_last_30_days: 0,
                days_left: null,
                category_id: null,
                category_name: null,
                supplier_id: null,
                supplier_name: null,
                supplier_contact: null,
                supplier_phone: null,
                last_entry_at: null,
                last_entry_quantity: null,
                status: "LOW",
            },
        ]);
        httpMock.expectOne("/api/low-stock-alerts/snoozed").flush([]);
        await TestBed.inject(LowStockAlertService).alerts.value;
        TestBed.tick();

        expect(service.count()).toBe(2);
    });

    it("should snooze and resume an alert", () => {
        const service = setup("admin");
        TestBed.tick();
        httpMock.expectOne("/api/low-stock-alerts").flush([]);
        httpMock.expectOne("/api/low-stock-alerts/snoozed").flush([]);

        service.snooze(3, 30).subscribe();
        const snooze = httpMock.expectOne("/api/low-stock-alerts/3/snooze");
        expect(snooze.request.method).toBe("PATCH");
        expect(snooze.request.body).toEqual({ days: 30 });
        snooze.flush({});

        service.snooze(3, null).subscribe();
        expect(httpMock.expectOne("/api/low-stock-alerts/3/snooze").request.body).toEqual({
            days: null,
        });
    });

    it("should also load the alerts for a manager", () => {
        const service = setup("manager");
        TestBed.tick();

        httpMock.expectOne("/api/low-stock-alerts").flush([]);
        httpMock.expectNone("/api/low-stock-alerts/snoozed");
        TestBed.tick();

        expect(service.count()).toBe(0);
    });
});

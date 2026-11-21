import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { API_URL } from "../../../core/api.config";
import { OwnerDashboard } from "./owner-dashboard";

const shop = (id: number, name: string, status: string, sales: number) => ({
    id,
    name,
    status,
    created_at: `2026-11-0${id}T10:00:00Z`,
    trial_ends_at: null,
    paid_until: null,
    access_ends_at: null,
    sales_last_30_days: sales,
});

describe("OwnerDashboard", () => {
    it("should sum the shops and flag the suspended ones", async () => {
        await TestBed.configureTestingModule({
            imports: [OwnerDashboard],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { user: signal({ name: "Yabré" }) } },
            ],
        }).compileComponents();

        const http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(OwnerDashboard);
        fixture.detectChanges();

        http.expectOne(`${API_URL}/shops`).flush([
            shop(1, "Alpha", "ACTIVE", 4),
            shop(2, "Beta", "SUSPENDED", 6),
        ]);
        http.expectOne(`${API_URL}/security/overview`).flush({
            failedLogins24h: 0,
            lockedAccounts: 0,
            failedLogins7d: 0,
            deniedAccess7d: 0,
            daily: [],
            topShops: [],
        });
        await fixture.whenStable();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
        expect(text).toContain("Bonjour Yabré");
        expect(text).toContain("Boutique suspendue");
        expect(text).toContain("Rien d'anormal");
        expect(fixture.componentInstance.sales()).toBe(10);
    });
});

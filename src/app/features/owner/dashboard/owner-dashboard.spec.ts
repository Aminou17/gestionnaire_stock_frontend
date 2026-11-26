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
                {
                    provide: AuthService,
                    useValue: {
                        user: signal({ name: "Yabré" }),
                        isOwner: () => true,
                        isAdmin: () => false,
                    },
                },
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
        http.match((r) => r.url === `${API_URL}/shops/stats/margins`).forEach((req) =>
            req.flush({
                days: 30,
                rows: [
                    {
                        shop_id: 1,
                        name: "Alpha",
                        sales_count: 4,
                        revenue: 100000,
                        cost: 70000,
                        margin: 30000,
                        margin_rate: 30,
                    },
                    {
                        shop_id: 2,
                        name: "Beta",
                        sales_count: 0,
                        revenue: 0,
                        cost: 0,
                        margin: 0,
                        margin_rate: null,
                    },
                ],
            }),
        );
        http.expectOne((r) => r.url === `${API_URL}/shops/stats/usage`).flush({
            days: 7,
            rows: [{ shop_id: 1, day: "2026-11-23", views: 12, employee_views: 5 }],
        });
        await fixture.whenStable();
        fixture.detectChanges();

        const text = ((fixture.nativeElement as HTMLElement).textContent ?? "").replace(/\s/g, " ");
        expect(text).toContain("Bonjour Yabré");
        expect(text).toContain("Boutique suspendue");
        expect(text).not.toContain("Sécurité");
        expect(fixture.componentInstance.sales()).toBe(10);
        // La marge de la boutique qui a vendu, et l'activité de la semaine
        expect(text).toContain("Marge par boutique");
        expect(text).toContain("30 000 F");
        expect(text).toContain("12 pages");
        expect(text).toContain("dont 5 par les vendeurs");
    });

    const renderWatch = async (shops: object[]) => {
        await TestBed.configureTestingModule({
            imports: [OwnerDashboard],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: {
                        user: signal({ name: "Yabré" }),
                        isOwner: () => true,
                        isAdmin: () => false,
                    },
                },
            ],
        }).compileComponents();

        const http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(OwnerDashboard);
        fixture.detectChanges();

        http.expectOne(`${API_URL}/shops`).flush(shops);
        http.expectOne(`${API_URL}/security/overview`).flush({
            failedLogins24h: 0,
            lockedAccounts: 0,
            failedLogins7d: 0,
            deniedAccess7d: 0,
            daily: [],
            topShops: [],
        });
        http.match((r) => r.url === `${API_URL}/shops/stats/margins`).forEach((req) =>
            req.flush({ days: 30, rows: [] }),
        );
        http.match((r) => r.url === `${API_URL}/shops/stats/usage`).forEach((req) =>
            req.flush({ days: 7, rows: [] }),
        );
        await fixture.whenStable();
        fixture.detectChanges();

        return fixture;
    };

    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

    it("should say nothing to report when every shop is fine", async () => {
        const fixture = await renderWatch([
            {
                ...shop(1, "Alpha", "ACTIVE", 4),
                trial_ends_at: inDays(20),
                access_ends_at: inDays(20),
            },
        ]);
        const text = (fixture.nativeElement as HTMLElement).textContent ?? "";

        expect(fixture.componentInstance.toWatch().length).toBe(0);
        expect(text).toContain("Rien à signaler");
    });

    it("should list a trial ending soon and an ended access, not a healthy shop", async () => {
        const fixture = await renderWatch([
            {
                ...shop(1, "Alpha", "ACTIVE", 4),
                trial_ends_at: inDays(20),
                access_ends_at: inDays(20),
            },
            {
                ...shop(2, "Beta", "ACTIVE", 1),
                trial_ends_at: inDays(3),
                access_ends_at: inDays(3),
            },
            {
                ...shop(3, "Gamma", "ACTIVE", 0),
                trial_ends_at: inDays(-30),
                access_ends_at: inDays(-30),
            },
        ]);
        const text = (fixture.nativeElement as HTMLElement).textContent ?? "";

        expect(fixture.componentInstance.toWatch().map((item) => item.shop.name)).toEqual([
            "Beta",
            "Gamma",
        ]);
        expect(text).toContain("Essai terminé");
        expect(text).not.toContain("Rien à signaler");
    });

    it("should show at most five shops to watch", async () => {
        const fixture = await renderWatch(
            [1, 2, 3, 4, 5, 6, 7].map((id) => shop(id, `Boutique ${id}`, "SUSPENDED", 0)),
        );

        expect(fixture.componentInstance.toWatch().length).toBe(5);
    });
});

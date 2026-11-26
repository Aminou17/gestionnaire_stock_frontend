import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { SecurityOverview } from "./security-overview";
import { SecurityService } from "../security.service";

const overview = (failedLogins24h: number, lockedAccounts: number) => ({
    failedLogins24h,
    failedLogins7d: 9,
    accessDenied7d: 2,
    lockedAccounts,
    topShops: [{ id: 1, name: "Chez Adam", failed_logins: 4, access_denied: 1 }],
    daily: [{ day: "2026-11-20", failed_logins: 4, access_denied: 1 }],
});

const render = async (data: ReturnType<typeof overview>) => {
    await TestBed.configureTestingModule({
        imports: [SecurityOverview],
        providers: [
            provideRouter([]),
            { provide: SecurityService, useValue: { getOverview: () => of(data) } },
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SecurityOverview);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
};

describe("SecurityOverview", () => {
    it("should say everything is calm when nothing happened", async () => {
        const el = await render(overview(0, 0));

        expect(el.querySelector(".status")?.textContent).toContain("Rien d'anormal");
        expect(el.querySelector(".status.warn")).toBeNull();
    });

    it("should warn about failed logins and locked accounts", async () => {
        const el = await render(overview(3, 1));

        const text = el.querySelector(".status.warn")?.textContent ?? "";
        expect(text).toContain("3 connexions échouées");
        expect(text).toContain("1 compte bloqué");
        expect(el.querySelectorAll(".kpi").length).toBe(4);
        expect(el.querySelector(".shop-name")?.textContent).toContain("Chez Adam");
    });
});

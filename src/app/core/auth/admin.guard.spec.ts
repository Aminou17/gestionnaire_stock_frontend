import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { adminGuard } from "./admin.guard";
import { AuthService } from "./auth.service";

describe("adminGuard", () => {
    let admin: boolean;

    beforeEach(() => {
        admin = false;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isAdmin: () => admin } },
            ],
        });
    });

    const run = () => TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

    it("should allow an admin", () => {
        admin = true;
        expect(run()).toBe(true);
    });

    it("should send a manager back to the dashboard", () => {
        const url = TestBed.inject(Router).serializeUrl(run() as UrlTree);
        expect(url).toBe("/dashboard?reserved=1");
    });
});

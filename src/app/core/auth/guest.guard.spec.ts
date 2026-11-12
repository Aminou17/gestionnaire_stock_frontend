import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { guestGuard } from "./guest.guard";
import { AuthService } from "./auth.service";

describe("guestGuard", () => {
    let loggedIn: boolean;

    beforeEach(() => {
        loggedIn = false;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
            ],
        });
    });

    const run = () => TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any));

    it("should allow access when logged out", () => {
        expect(run()).toBe(true);
    });

    it("should redirect to /dashboard when already logged in", () => {
        loggedIn = true;
        const url = TestBed.inject(Router).serializeUrl(run() as UrlTree);
        expect(url).toBe("/dashboard");
    });
});

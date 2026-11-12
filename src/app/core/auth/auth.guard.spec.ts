import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { authGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

describe("authGuard", () => {
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

    const run = () => TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    it("should allow access when logged in", () => {
        loggedIn = true;
        expect(run()).toBe(true);
    });

    it("should redirect to /login when logged out", () => {
        const url = TestBed.inject(Router).serializeUrl(run() as UrlTree);
        expect(url).toBe("/login");
    });
});

import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { AuthService } from "./auth.service";
import { passwordChangeGuard } from "./password-change.guard";

describe("passwordChangeGuard", () => {
    let mustChange: boolean | undefined;
    let user: boolean;

    beforeEach(() => {
        mustChange = false;
        user = true;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { user: () => (user ? { mustChangePassword: mustChange } : null) },
                },
            ],
        });
    });

    const run = (url: string) =>
        TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, { url } as any));

    it("should send the user to /settings/password with a temporary password", () => {
        mustChange = true;

        const result = run("/dashboard") as UrlTree;

        expect(TestBed.inject(Router).serializeUrl(result)).toBe("/settings/password");
    });

    it("should let the user stay on /settings/password, with or without a query string", () => {
        mustChange = true;

        expect(run("/settings/password")).toBe(true);
        expect(run("/settings/password?x=1")).toBe(true);
    });

    it("should let everything through without the flag", () => {
        expect(run("/dashboard")).toBe(true);

        mustChange = undefined;
        expect(run("/products")).toBe(true);
    });

    it("should let everything through when nobody is logged in", () => {
        user = false;

        expect(run("/login")).toBe(true);
    });
});

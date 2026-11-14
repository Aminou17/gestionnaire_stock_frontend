import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { AuthService } from "./auth.service";
import { ownerGuard } from "./owner.guard";

describe("ownerGuard", () => {
    let owner: boolean;

    beforeEach(() => {
        owner = false;
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isOwner: () => owner } },
            ],
        });
    });

    const run = () => TestBed.runInInjectionContext(() => ownerGuard({} as any, {} as any));

    it("should allow the owner", () => {
        owner = true;
        expect(run()).toBe(true);
    });

    it("should send a shop account back to its dashboard", () => {
        const url = TestBed.inject(Router).serializeUrl(run() as UrlTree);
        expect(url).toBe("/dashboard");
    });
});

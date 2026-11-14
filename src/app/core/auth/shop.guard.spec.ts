import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { AuthService } from "./auth.service";
import { shopGuard } from "./shop.guard";

describe("shopGuard", () => {
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

    const run = () => TestBed.runInInjectionContext(() => shopGuard({} as any, {} as any));

    it("should allow an admin or a manager", () => {
        expect(run()).toBe(true);
    });

    it("should send the owner to the list of shops", () => {
        owner = true;
        const url = TestBed.inject(Router).serializeUrl(run() as UrlTree);
        expect(url).toBe("/owner");
    });
});

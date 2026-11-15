import { TestBed } from "@angular/core/testing";
import { Router, UrlTree, provideRouter } from "@angular/router";

import { markWelcomeSeen, welcomeGuard } from "./welcome.guard";

describe("welcomeGuard", () => {
    const run = () => TestBed.runInInjectionContext(() => welcomeGuard({} as never, {} as never));

    // jsdom n'a pas matchMedia : on le fournit pour le test
    const setPhone = (isPhone: boolean) =>
        vi.stubGlobal("matchMedia", () => ({ matches: isPhone }) as MediaQueryList);

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({ providers: [provideRouter([])] });
    });

    afterEach(() => vi.unstubAllGlobals());

    it("should send a phone to the welcome screen the first time", () => {
        setPhone(true);
        const result = run() as UrlTree;
        expect(TestBed.inject(Router).serializeUrl(result)).toBe("/welcome");
    });

    it("should let the visitor through once the welcome screen was seen", () => {
        setPhone(true);
        markWelcomeSeen();
        expect(run()).toBe(true);
    });

    it("should never show the welcome screen on a computer", () => {
        setPhone(false);
        expect(run()).toBe(true);
    });
});

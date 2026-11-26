import { TestBed } from "@angular/core/testing";

import { ThemeService } from "./theme.service";

function systemPrefers(dark: boolean) {
    vi.stubGlobal("matchMedia", () => ({
        matches: dark,
        addEventListener: () => {},
    }));
}

describe("ThemeService", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.unstubAllGlobals());

    it("should follow a dark phone by default", () => {
        systemPrefers(true);

        expect(TestBed.inject(ThemeService).theme()).toBe("dark");
    });

    it("should stay light on a light phone by default", () => {
        systemPrefers(false);

        expect(TestBed.inject(ThemeService).theme()).toBe("light");
    });

    it("should prefer the saved choice over the phone setting", () => {
        systemPrefers(true);
        localStorage.setItem("theme", "light");

        expect(TestBed.inject(ThemeService).theme()).toBe("light");
    });

    it("should save only a deliberate choice", () => {
        systemPrefers(true);
        const service = TestBed.inject(ThemeService);

        expect(localStorage.getItem("theme")).toBeNull();

        service.toggle();

        expect(service.theme()).toBe("light");
        expect(localStorage.getItem("theme")).toBe("light");
    });

    it("should restore a saved dark theme on a light phone", () => {
        systemPrefers(false);
        localStorage.setItem("theme", "dark");

        expect(TestBed.inject(ThemeService).theme()).toBe("dark");
    });

    it("should apply the theme to the document", () => {
        systemPrefers(false);
        localStorage.setItem("theme", "light");
        const service = TestBed.inject(ThemeService);

        service.toggle();
        TestBed.tick();

        expect(document.documentElement.dataset["theme"]).toBe("dark");
    });
});

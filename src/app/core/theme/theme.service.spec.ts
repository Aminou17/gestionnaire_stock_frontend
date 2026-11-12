import { TestBed } from "@angular/core/testing";

import { ThemeService } from "./theme.service";

describe("ThemeService", () => {
    beforeEach(() => localStorage.clear());

    // le système de l'utilisateur est en sombre, mais l'app doit démarrer en clair
    it("should start in light mode when nothing is saved", () => {
        window.matchMedia = (() => ({ matches: true })) as any;
        const service = TestBed.inject(ThemeService);

        expect(service.theme()).toBe("light");
    });

    it("should restore the saved theme", () => {
        localStorage.setItem("theme", "dark");
        const service = TestBed.inject(ThemeService);

        expect(service.theme()).toBe("dark");
    });

    it("should toggle and apply the theme to the document", () => {
        localStorage.setItem("theme", "light");
        const service = TestBed.inject(ThemeService);

        service.toggle();
        TestBed.tick();

        expect(service.theme()).toBe("dark");
        expect(document.documentElement.dataset["theme"]).toBe("dark");
        expect(localStorage.getItem("theme")).toBe("dark");
    });
});

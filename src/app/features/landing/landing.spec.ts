import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { Landing } from "./landing";

describe("Landing", () => {
    async function render() {
        await TestBed.configureTestingModule({
            imports: [Landing],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(Landing);
        await fixture.whenStable();

        return fixture.nativeElement as HTMLElement;
    }

    const hrefs = (page: HTMLElement, selector: string) =>
        Array.from(page.querySelectorAll(selector)).map((link) => link.getAttribute("href"));

    it("should offer both choices above the fold: create a shop and sign in", async () => {
        const page = await render();
        const hero = page.querySelector(".hero")!;

        expect(hero.querySelector(".cta-main")!.getAttribute("href")).toBe("/register");
        expect(hero.querySelector(".cta-second")!.getAttribute("href")).toBe("/login");
        expect(hero.querySelector("h1")!.textContent).toContain(
            "Gérez votre boutique, sans prise de tête.",
        );
    });

    it("should keep a sign in link in the header", async () => {
        const page = await render();

        expect(hrefs(page, ".top-actions a")).toEqual(["/login", "/register"]);
    });

    it("should list six reasons and three steps", async () => {
        const page = await render();

        expect(page.querySelectorAll(".reason").length).toBe(6);
        expect(page.querySelectorAll(".step").length).toBe(3);
    });

    it("should describe every picture of the product for screen readers", async () => {
        const page = await render();
        const images = Array.from(page.querySelectorAll<HTMLImageElement>("main img"));

        expect(images.length).toBe(7);
        for (const image of images) expect(image.alt.length).toBeGreaterThan(20);
    });

    it("should link to the legal pages in the footer", async () => {
        const page = await render();

        expect(hrefs(page, ".legal a")).toEqual(["/privacy", "/terms", "/contact"]);
    });

    it("should scroll to a section when its link is used", async () => {
        const page = await render();
        const target = page.querySelector<HTMLElement>("#raisons")!;
        const scroll = vi.fn();
        target.scrollIntoView = scroll;
        document.body.append(page);

        page.querySelector<HTMLButtonElement>(".top-nav button")!.click();

        expect(scroll).toHaveBeenCalled();
        page.remove();
    });

    it("should show four strengths under the hero", async () => {
        const page = await render();

        expect(page.querySelectorAll(".atout").length).toBe(4);
    });

    it("should not leave a stray character under the badge", async () => {
        const page = await render();
        const text = page.querySelector(".hero-text")!.textContent!;

        expect(text).not.toMatch(/gratuit\s*>/);
    });

    it("should offer a fixed create button for phones, hidden at first", async () => {
        const page = await render();
        const button = page.querySelector(".sticky-cta")!;

        expect(button.getAttribute("href")).toBe("/register");
        expect(button.classList.contains("visible")).toBe(false);
    });

    it("should keep the content visible when the browser cannot observe scrolling", async () => {
        const original = window.IntersectionObserver;
        // @ts-expect-error simule un navigateur sans l'API
        delete window.IntersectionObserver;

        const page = await render();
        window.IntersectionObserver = original;

        expect(page.closest(".animated")).toBeNull();
        expect(page.querySelector(".reveal")).not.toBeNull();
    });
});

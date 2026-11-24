import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { Landing } from "./landing";

describe("Landing", () => {
    let fixture: ComponentFixture<Landing>;

    async function render() {
        await TestBed.configureTestingModule({
            imports: [Landing],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(Landing);
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

        expect(images.length).toBe(30);
        for (const image of images) expect(image.alt.length).toBeGreaterThan(20);
    });

    it("should show the sale step by step on the phone and four pages on the computer", async () => {
        const page = await render();

        expect(page.querySelectorAll(".slides-tel img").length).toBe(4);
        expect(page.querySelectorAll(".slides-pc img").length).toBe(4);
    });

    it("should show the same page on a computer and a phone, and switch with the tabs", async () => {
        const page = await render();
        const tabs = page.querySelectorAll<HTMLButtonElement>(".tab");

        expect(tabs.length).toBe(7);
        expect(page.querySelector(".stack-pc img.on")!.getAttribute("src")).toBe(
            "/landing/pc-vente.webp",
        );
        expect(page.querySelector(".stack-tel img.on")!.getAttribute("src")).toBe(
            "/landing/tel-vente-3.webp",
        );

        tabs[2].click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(page.querySelector(".stack-pc img.on")!.getAttribute("src")).toBe(
            "/landing/pc-produits.webp",
        );
        expect(page.querySelector(".stack-tel img.on")!.getAttribute("src")).toBe(
            "/landing/tel-produits.webp",
        );
        expect(tabs[2].getAttribute("aria-pressed")).toBe("true");
        expect(page.querySelector(".pair-caption")!.textContent).toContain("photo");
    });

    it("should explain what the administrator and the employee see, with both screens", async () => {
        const page = await render();
        const who = page.querySelectorAll(".who");

        expect(who.length).toBe(2);
        expect(who[0].textContent).toContain("administrateur");
        expect(who[1].textContent).toContain("Ni bénéfices");
        for (const card of Array.from(who)) {
            expect(card.querySelectorAll(".browser").length).toBe(1);
            expect(card.querySelectorAll(".phone").length).toBe(1);
        }
        expect(page.querySelectorAll(".feature").length).toBe(2);
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

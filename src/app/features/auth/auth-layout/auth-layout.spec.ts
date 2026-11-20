import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
    async function render() {
        await TestBed.configureTestingModule({
            imports: [AuthLayout],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(AuthLayout);
        await fixture.whenStable();

        return fixture.nativeElement as HTMLElement;
    }

    it("should show the software brand, never the name of a shop", async () => {
        const page = await render();

        expect(page.querySelector(".brand-icon")).not.toBeNull();
        expect(page.textContent).toContain("Boutiki");
        expect(page.textContent).not.toContain("Awa Bazin");
    });

    it("should show no invented figures, only the footer on small screens", async () => {
        const page = await render();
        const pitch = page.querySelector(".mobile-pitch")!;

        expect(page.querySelector(".main-card")).toBeNull();
        expect(page.textContent).not.toContain("284 500");
        expect(pitch.querySelector("footer")?.textContent).toContain("Boutiki · YABRE TECH");
    });

    it("should come after the form in the page", async () => {
        const page = await render();
        const card = page.querySelector(".card")!;
        const pitch = page.querySelector(".mobile-pitch")!;

        expect(card.compareDocumentPosition(pitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should link to the legal pages in the page footer", async () => {
        const page = await render();
        const links = Array.from(page.querySelectorAll(".legal-links a")).map((link) =>
            link.getAttribute("href"),
        );

        // un pied de page sur ordinateur, un autre sous la présentation sur téléphone
        expect(links).toEqual(["/privacy", "/terms", "/contact", "/privacy", "/terms", "/contact"]);
    });
});

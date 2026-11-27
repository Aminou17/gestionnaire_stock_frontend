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

        expect(page.querySelector(".brand-logo")).not.toBeNull();
        expect(page.textContent).toContain("Boutiki");
        expect(page.textContent).not.toContain("Adam Ouédraogo");
    });

    it("should lead back to the home page from the brand and from the Accueil link", async () => {
        const page = await render();
        const links = Array.from(page.querySelectorAll(".brand, .home")).map((link) =>
            link.getAttribute("href"),
        );

        expect(links).toEqual(["/", "/"]);
    });

    it("should keep only the contact link in the footer", async () => {
        const page = await render();
        const links = Array.from(page.querySelectorAll(".legal-links a")).map((link) =>
            link.getAttribute("href"),
        );

        expect(links).toEqual(["/contact"]);
    });
});

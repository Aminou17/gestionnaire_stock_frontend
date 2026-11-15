import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { LegalPage } from "./legal-page";
import { LegalSection } from "./legal-section";

const SECTIONS: LegalSection[] = [
    { id: "un", title: "Premier", body: ["Un paragraphe.", ["Point A", "Point B"]] },
    { id: "deux", title: "Second", body: ["Autre texte."] },
];

@Component({
    imports: [LegalPage],
    template: `<app-legal-page
        title="Ma page"
        updated="Dernière mise à jour : test"
        [sections]="sections"
    />`,
})
class Host {
    sections = SECTIONS;
}

describe("LegalPage", () => {
    async function render(loggedIn: boolean) {
        await TestBed.configureTestingModule({
            imports: [Host],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it("affiche un seul h1, des h2 numérotés et le sommaire", async () => {
        const el = await render(false);

        expect(el.querySelectorAll("h1").length).toBe(1);
        expect(el.querySelectorAll("h2").length).toBe(2);
        expect(el.querySelectorAll(".toc li a").length).toBe(2);
        expect(el.querySelector("h2 .num")?.textContent?.trim()).toBe("1");
    });

    it("rend les listes à puces", async () => {
        const el = await render(false);

        expect(el.querySelectorAll(".doc li").length).toBe(2);
    });

    it("propose la connexion sans session et l'espace avec session", async () => {
        expect((await render(false)).textContent).toContain("Se connecter");

        TestBed.resetTestingModule();
        expect((await render(true)).textContent).toContain("Mon espace");
    });

    it("affiche les liens du pied de page", async () => {
        const el = await render(false);
        const links = Array.from(el.querySelectorAll(".foot a")).map((a) => a.getAttribute("href"));

        expect(links).toEqual(["/privacy", "/terms", "/contact"]);
    });
});

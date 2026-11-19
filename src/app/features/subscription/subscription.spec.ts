import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Subscription } from "./subscription";

@Component({ selector: "app-page-header", template: "" })
class HeaderStub {
    title = input<string>();
    subtitle = input<string>();
}

describe("Subscription", () => {
    async function render() {
        await TestBed.configureTestingModule({
            imports: [Subscription],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { user: () => null, isAdmin: () => true, roleLabel: () => "Admin" },
                },
            ],
        })
            // l'en-tête (cloche, menu) a ses propres tests
            .overrideComponent(Subscription, {
                remove: { imports: [PageHeader] },
                add: { imports: [HeaderStub] },
            })
            .compileComponents();

        const fixture = TestBed.createComponent(Subscription);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it("annonce l'essai gratuit sans inventer de prix", async () => {
        const el = await render();
        const text = el.textContent ?? "";

        expect(text).toContain("Essai gratuit");
        expect(text).toContain("Gratuit pendant le lancement");
        expect(text).not.toMatch(/\d+\s?(F|FCFA|€)/);
    });

    it("montre les trois formules grisées et les moyens de paiement prévus", async () => {
        const el = await render();

        expect(el.querySelectorAll(".plan").length).toBe(3);
        expect(el.querySelectorAll(".plan .badge").length).toBe(3);
        expect(el.querySelectorAll(".pill").length).toBe(2);
    });

    it("propose de nous contacter", async () => {
        const el = await render();

        expect(el.querySelector(".help a[href='/contact']")).not.toBeNull();
        expect(el.querySelector(".wa")?.getAttribute("href")).toContain("wa.me");
    });
});

import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Subscription } from "./subscription";

@Component({ selector: "app-page-header", template: "" })
class HeaderStub {
    title = input<string>();
    subtitle = input<string>();
}

describe("Subscription", () => {
    async function render(trialEndsAt: string | null = null) {
        await TestBed.configureTestingModule({
            imports: [Subscription],
            providers: [
                provideRouter([]),
                { provide: ShopSettingsService, useValue: { trialEndsAt: () => trialEndsAt } },
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

    it("affiche les jours d'essai restants", async () => {
        const inTenDays = new Date(Date.now() + 9.5 * 86_400_000).toISOString();
        const el = await render(inTenDays);
        expect(el.querySelector(".trial .days")?.textContent?.trim()).toBe("10");
        expect(el.querySelector(".trial")?.textContent).toContain("jours d'essai restants");
    });

    it("signale un essai terminé", async () => {
        const el = await render(new Date(Date.now() - 86_400_000).toISOString());
        expect(el.querySelector(".trial.ended")?.textContent).toContain("s'est terminé");
        expect(el.querySelector(".badge-warning")?.textContent).toContain("Essai terminé");
    });

    it("n'affiche rien sans date de fin", async () => {
        const el = await render(null);
        expect(el.querySelector(".trial")).toBeNull();
    });
});

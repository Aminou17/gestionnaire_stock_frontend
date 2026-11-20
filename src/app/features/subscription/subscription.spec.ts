import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { Access, AuthService } from "../../core/auth/auth.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Subscription } from "./subscription";

@Component({ selector: "app-page-header", template: "" })
class HeaderStub {
    title = input<string>();
    subtitle = input<string>();
}

describe("Subscription", () => {
    async function render(access: Access | null = null) {
        await TestBed.configureTestingModule({
            imports: [Subscription],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        user: () => null,
                        isAdmin: () => true,
                        roleLabel: () => "Admin",
                        access: () => access,
                    },
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

    const trial = (days: number): Access => ({
        state: "trial",
        endsAt: new Date(Date.now() + days * 86_400_000).toISOString(),
        daysLeft: Math.ceil(days),
        blocked: false,
    });

    it("annonce l'essai gratuit sans inventer de prix", async () => {
        const el = await render(trial(10));
        const text = el.textContent ?? "";

        expect(text).toContain("Essai gratuit");
        expect(text).toContain("7 jours avant la fin");
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

    it("affiche les jours restants donnés par le serveur", async () => {
        const el = await render(trial(9.5));
        expect(el.querySelector(".trial .days")?.textContent?.trim()).toBe("10");
        expect(el.querySelector(".trial")?.textContent).toContain("jours restants");
    });

    it("affiche un abonnement payé", async () => {
        const el = await render({ ...trial(40), state: "paid" });
        expect(el.querySelector(".badge-success")?.textContent).toContain("Abonnement actif");
    });

    it("signale les jours de grâce après l'échéance", async () => {
        const el = await render({
            state: "grace",
            endsAt: new Date(Date.now() - 86_400_000).toISOString(),
            daysLeft: 2,
            blocked: false,
        });
        expect(el.querySelector(".trial.ended")?.textContent).toContain("coupé dans 2");
        expect(el.querySelector(".badge-danger")?.textContent).toContain("Échéance passée");
    });

    it("n'affiche aucun compte à rebours sans date de fin", async () => {
        const el = await render(null);
        expect(el.querySelector(".trial")).toBeNull();
        expect(el.textContent).toContain("Sans limite");
    });
});

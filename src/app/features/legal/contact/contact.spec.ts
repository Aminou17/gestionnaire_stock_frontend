import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { SupportService } from "../../../core/support/support.service";
import { CONTACT } from "../../../core/contact";
import { Contact } from "./contact";

describe("Contact", () => {
    async function render(user: { role: string; name: string } | null = null) {
        await TestBed.configureTestingModule({
            imports: [Contact],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { isLoggedIn: () => !!user, user: () => user },
                },
                { provide: ShopSettingsService, useValue: { shopName: () => "Chez Fatou" } },
                { provide: SupportService, useValue: { unread: () => 2, refreshUnread: () => {} } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Contact);
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it("sans session : propose l'e-mail et la connexion", async () => {
        const { el } = await render();
        const first = el.querySelector(".way.main");

        expect(first?.getAttribute("href")).toBe(`mailto:${CONTACT.email}`);
        expect(el.querySelector('a[href="/support/new"]')).toBeNull();
    });

    it("connecté : propose d'écrire au support dans l'application", async () => {
        const { el } = await render({ role: "admin", name: "Fatou Diallo" });

        expect(el.querySelector('a[href="/support/new"]')).not.toBeNull();
        expect(el.textContent).toContain("2 nouvelles");
    });

    it("WhatsApp : seulement le logo, jamais le numéro", async () => {
        const { el } = await render();
        const link = el.querySelector<HTMLAnchorElement>(".wa-button")!;

        expect(link.href).toContain(`https://wa.me/${CONTACT.whatsappDigits}?text=`);
        expect(el.textContent).not.toContain("64 72 54 64");
        expect(el.textContent).not.toContain(CONTACT.whatsappDigits);
    });

    it("WhatsApp : le message prérempli donne le nom et la boutique", async () => {
        const { el } = await render({ role: "manager", name: "Awa Traoré" });
        const link = el.querySelector<HTMLAnchorElement>(".wa-button")!;
        const text = decodeURIComponent(link.href.split("text=")[1]);

        expect(text).toContain("Awa Traoré");
        expect(text).toContain("Chez Fatou");
    });

    it("ouvre une seule réponse à la fois", async () => {
        const { fixture, el } = await render();
        const buttons = () => el.querySelectorAll<HTMLButtonElement>(".item button");

        expect(el.querySelectorAll(".answer").length).toBe(0);

        buttons()[0].click();
        fixture.detectChanges();
        expect(el.querySelectorAll(".answer").length).toBe(1);

        buttons()[1].click();
        fixture.detectChanges();
        expect(el.querySelectorAll(".answer").length).toBe(1);
        expect(buttons()[1].getAttribute("aria-expanded")).toBe("true");

        buttons()[1].click();
        fixture.detectChanges();
        expect(el.querySelectorAll(".answer").length).toBe(0);
    });
});

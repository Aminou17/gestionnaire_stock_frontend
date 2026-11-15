import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { CONTACT } from "../../../core/contact";
import { Contact } from "./contact";

describe("Contact", () => {
    async function render() {
        await TestBed.configureTestingModule({
            imports: [Contact],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isLoggedIn: () => false } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Contact);
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    it("lie l'e-mail et WhatsApp depuis core/contact", async () => {
        const { el } = await render();
        const hrefs = Array.from(el.querySelectorAll(".way")).map((a) => a.getAttribute("href"));

        expect(hrefs[0]).toBe(`mailto:${CONTACT.email}`);
        expect(hrefs[1]).toContain(`https://wa.me/${CONTACT.whatsappDigits}?text=`);
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

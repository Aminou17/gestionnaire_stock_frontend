import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { OwnerLayout } from "./owner-layout";

describe("OwnerLayout", () => {
    it("should show the owner space with a way to sign out", async () => {
        const logoutAsked = signal(false);
        await TestBed.configureTestingModule({
            imports: [OwnerLayout],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { user: signal({ name: "Yabré" }), logoutAsked },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(OwnerLayout);
        await fixture.whenStable();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.textContent).toContain("Espace propriétaire");
        expect(el.textContent).toContain("Yabré");
        const password = el.querySelector('a[aria-label="Mot de passe"]');
        expect(password?.getAttribute("href")).toBe("/owner/password");
        (el.querySelector(".tools .btn") as HTMLButtonElement).click();
        // un seul clic ouvre la confirmation, il ne déconnecte pas
        expect(logoutAsked()).toBe(true);
    });
});

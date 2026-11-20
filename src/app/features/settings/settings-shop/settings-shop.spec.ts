import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsShop } from "./settings-shop";

const shop = {
    name: "Awa Bazin",
    address: "Grand marché",
    phone: null,
    tax_id: null,
    rccm: null,
    receipt_footer: "Ni repris ni échangé.",
    logo: null,
    default_country_code: "242",
    updated_at: null,
};

describe("SettingsShop", () => {
    let fixture: ComponentFixture<SettingsShop>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;

    async function render(loadError = false) {
        updateSettings = vi.fn((input) =>
            of({ ...shop, name: input.name, address: input.address }),
        );

        await TestBed.configureTestingModule({
            imports: [SettingsShop],
            providers: [
                provideRouter([]),
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: ShopSettingsService,
                    useValue: {
                        getSettings: () =>
                            loadError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of(shop),
                        updateSettings,
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Admin", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsShop);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const input = (name: string) =>
        el.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;

    async function type(name: string, value: string) {
        input(name).value = value;
        input(name).dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function submit() {
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    }

    it("should fill the form with the saved information", async () => {
        await render();

        expect(input("name").value).toBe("Awa Bazin");
        expect(input("address").value).toBe("Grand marché");
    });

    it("should go back to the settings by default", async () => {
        await render();

        expect(el.querySelector(".back-btn")!.getAttribute("href")).toBe("/settings");
    });

    it("should save and keep the receipt message", async () => {
        await render();

        await type("address", "Marché Total");
        await submit();

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Awa Bazin",
                address: "Marché Total",
                receiptFooter: "Ni repris ni échangé.",
            }),
        );
        expect(el.textContent).toContain("Enregistré.");
    });

    it("should show the default country code and its country", async () => {
        await render();

        expect(input("defaultCountryCode").value).toBe("242");
        expect(el.textContent).toContain("Congo-Brazzaville");
        expect(el.textContent).toContain("numéros saisis sans indicatif");
    });

    it("should save a new country code with the digits only", async () => {
        await render();

        await type("defaultCountryCode", "+226");
        await submit();

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ defaultCountryCode: "226" }),
        );
    });

    it("should offer the country code of the shop phone when it differs", async () => {
        await render();
        expect(el.querySelector(".code-hint")).toBeNull();

        await type("phone", "+226 66 09 90 60");
        expect(el.querySelector(".code-hint")?.textContent).toContain("+226");

        el.querySelector<HTMLButtonElement>(".code-hint button")!.click();
        await fixture.whenStable();

        expect(input("defaultCountryCode").value).toBe("226");
        expect(el.querySelector(".code-hint")).toBeNull();
    });

    it("should not save without a country code", async () => {
        await render();

        await type("defaultCountryCode", "");
        await submit();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("1 à 4 chiffres");
    });

    it("should not save without a shop name", async () => {
        await render();

        await type("name", "");
        await submit();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Le nom est obligatoire.");
    });

    it("should show the save bar only when there are changes", async () => {
        await render();

        expect(el.querySelector(".savebar")).toBeNull();

        await type("address", "Autre adresse");

        expect(el.querySelector(".savebar")).not.toBeNull();
    });

    it("should preview the ticket header while typing", async () => {
        await render();

        await type("name", "Chez Awa");

        expect(el.querySelector(".ticket")!.textContent).toContain("Chez Awa");
    });

    it("should restore the saved values on cancel", async () => {
        await render();

        await type("address", "Autre adresse");
        el.querySelector<HTMLButtonElement>(".savebar .btn-outline")!.click();
        await fixture.whenStable();

        expect(input("address").value).toBe("Grand marché");
    });

    it("should offer to retry when loading fails", async () => {
        await render(true);

        expect(el.textContent).toContain("Impossible de charger les informations de la boutique.");
        expect(el.textContent).toContain("Réessayer");
    });

    it("should ask before leaving with unsaved changes", async () => {
        await render();

        await type("address", "Autre adresse");
        const ask = vi.fn(() => Promise.resolve(false));
        fixture.debugElement.query((d) => d.name === "app-unsaved-dialog").componentInstance.ask =
            ask;

        expect(await fixture.componentInstance.canLeave()).toBe(false);
        expect(ask).toHaveBeenCalled();
    });

    it("should leave without question when nothing changed", async () => {
        await render();

        expect(fixture.componentInstance.canLeave()).toBe(true);
    });

    it("should hide the success message as soon as the form is edited again", async () => {
        await render();

        await type("address", "Marché Total");
        await submit();
        expect(el.textContent).toContain("Enregistré.");

        await type("address", "Marché Total 2");

        expect(el.textContent).not.toContain("Enregistré.");
    });
});

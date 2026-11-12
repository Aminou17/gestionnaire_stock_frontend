import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsSales } from "./settings-sales";

describe("SettingsSales", () => {
    let fixture: ComponentFixture<SettingsSales>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;

    async function render(loadError = false) {
        updateSettings = vi.fn((input) =>
            of({
                ticket_prefix: input.ticketPrefix,
                default_max_discount: input.defaultMaxDiscount,
                updated_at: null,
            }),
        );

        await TestBed.configureTestingModule({
            imports: [SettingsSales],
            providers: [
                provideRouter([]),
                {
                    provide: SalesSettingsService,
                    useValue: {
                        getSettings: () =>
                            loadError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of({ ticket_prefix: "AB", default_max_discount: 500 }),
                        updateSettings,
                    },
                },
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        user: signal({ id: 1, name: "Admin", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Propriétaire"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsSales);
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

    it("should show the saved settings and an example of ticket number", async () => {
        await render();

        expect(input("ticketPrefix").value).toBe("AB");
        expect(input("defaultMaxDiscount").value).toBe("500");
        expect(el.textContent).toContain("AB-000012");
    });

    it("should update the example while typing the prefix", async () => {
        await render();

        await type("ticketPrefix", "BZ");

        expect(el.textContent).toContain("BZ-000012");
    });

    it("should save the settings and clear the discount when left empty", async () => {
        await render();

        await type("defaultMaxDiscount", "");
        await submit();

        expect(updateSettings).toHaveBeenCalledWith({
            ticketPrefix: "AB",
            defaultMaxDiscount: null,
        });
        expect(el.textContent).toContain("Réglages des ventes enregistrés.");
    });

    it("should refuse a prefix with a space", async () => {
        await render();

        await type("ticketPrefix", "A B");
        await submit();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("10 lettres ou chiffres au maximum");
    });

    it("should refuse a decimal discount", async () => {
        await render();

        await type("defaultMaxDiscount", "2.5");
        await submit();

        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("should hide the success message as soon as the form is edited again", async () => {
        await render();

        await type("ticketPrefix", "ZZ");
        await submit();
        expect(el.textContent).toContain("Réglages des ventes enregistrés.");

        await type("ticketPrefix", "ZY");

        expect(el.textContent).not.toContain("Réglages des ventes enregistrés.");
    });

    it("should ask before leaving with unsaved changes", async () => {
        await render();

        await type("ticketPrefix", "ZZ");
        const leave = vi.fn(() => Promise.resolve(false));
        el.querySelector("dialog")!.showModal = vi.fn();
        const dialog = fixture.debugElement.query((d) => d.name === "app-unsaved-dialog");
        dialog.componentInstance.ask = leave;

        expect(await fixture.componentInstance.canLeave()).toBe(false);
        expect(leave).toHaveBeenCalled();
    });

    it("should leave without question when nothing changed", async () => {
        await render();

        expect(fixture.componentInstance.canLeave()).toBe(true);
    });

    it("should offer to retry when loading fails", async () => {
        await render(true);

        expect(el.textContent).toContain("Impossible de charger les réglages des ventes.");
        expect(el.querySelector('[formControlName="ticketPrefix"]')).toBeNull();
    });
});

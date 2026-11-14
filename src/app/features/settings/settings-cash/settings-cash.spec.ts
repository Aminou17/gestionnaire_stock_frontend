import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { CashSettingsService } from "../../../core/cash/cash-settings.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsCash } from "./settings-cash";

describe("SettingsCash", () => {
    let fixture: ComponentFixture<SettingsCash>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;

    async function render(loadError = false) {
        updateSettings = vi.fn((blindClose: boolean) =>
            of({ blind_close: blindClose, updated_at: null }),
        );

        await TestBed.configureTestingModule({
            imports: [SettingsCash],
            providers: [
                provideRouter([]),
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: CashSettingsService,
                    useValue: {
                        getSettings: () =>
                            loadError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of({ blind_close: true, updated_at: null }),
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

        fixture = TestBed.createComponent(SettingsCash);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const checkbox = () => el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    it("should show the saved value", async () => {
        await render();

        expect(checkbox().checked).toBe(true);
    });

    it("should turn off the blind close", async () => {
        await render();

        checkbox().click();
        await fixture.whenStable();
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(updateSettings).toHaveBeenCalledWith(false);
        expect(el.textContent).toContain("L'employé verra le solde attendu à la clôture.");
    });

    it("should not show a fake value when loading fails", async () => {
        await render(true);

        expect(checkbox()).toBeNull();
        expect(el.textContent).toContain("Impossible de charger les réglages de la caisse.");
    });

    it("should ask before leaving with unsaved changes", async () => {
        await render();

        checkbox().click();
        await fixture.whenStable();
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
});

import { registerLocaleData } from "@angular/common";
import localeFr from "@angular/common/locales/fr";
import { LOCALE_ID } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { SettingsHistory } from "./settings-history";
import { SettingsHistoryService } from "./settings-history.service";

registerLocaleData(localeFr);

describe("SettingsHistory", () => {
    let fixture: ComponentFixture<SettingsHistory>;
    let el: HTMLElement;

    async function render(getLastChange: ReturnType<typeof vi.fn>) {
        await TestBed.configureTestingModule({
            imports: [SettingsHistory],
            providers: [
                { provide: LOCALE_ID, useValue: "fr" },
                { provide: SettingsHistoryService, useValue: { getLastChange } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsHistory);
        fixture.componentRef.setInput("actions", ["CASH_SETTINGS_UPDATED"]);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should show who changed the setting and when", async () => {
        await render(
            vi.fn(() => of({ user_name: "Awa Traoré", created_at: "2026-11-12T15:40:00" })),
        );

        expect(el.textContent).toContain("12 novembre 2026 à 15:40");
        expect(el.textContent).toContain("par Awa Traoré");
    });

    it("should say so when the setting was never changed", async () => {
        await render(vi.fn(() => of(null)));

        expect(el.textContent).toContain("Jamais modifié");
    });

    it("should show a dash message instead of a fake date when the journal fails", async () => {
        await render(vi.fn(() => throwError(() => new Error("500"))));

        expect(el.textContent).toContain("Historique indisponible.");
    });

    it("should read again when the page raises the version", async () => {
        const getLastChange = vi.fn(() => of(null));
        await render(getLastChange);

        fixture.componentRef.setInput("version", 1);
        await fixture.whenStable();

        expect(getLastChange).toHaveBeenCalledTimes(2);
    });
});

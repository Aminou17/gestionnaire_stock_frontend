import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsStock } from "./settings-stock";

describe("SettingsStock", () => {
    let fixture: ComponentFixture<SettingsStock>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;

    async function render(
        loadError = false,
        saved: { id: number; min_stock: number } | null = {
            id: 1,
            min_stock: 10,
        },
    ) {
        updateSettings = vi.fn((minStock: number) => of({ id: 1, min_stock: minStock }));

        await TestBed.configureTestingModule({
            imports: [SettingsStock],
            providers: [
                provideRouter([]),
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: StockSettingsService,
                    useValue: {
                        getSettings: () =>
                            loadError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of(saved),
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

        fixture = TestBed.createComponent(SettingsStock);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const input = () => el.querySelector<HTMLInputElement>('[formControlName="minStock"]')!;

    async function typeAndSubmit(value: string) {
        input().value = value;
        input().dispatchEvent(new Event("input"));
        await fixture.whenStable();
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    }

    it("should show the saved threshold", async () => {
        await render();

        expect(input().value).toBe("10");
    });

    it("should save the general threshold", async () => {
        await render();

        await typeAndSubmit("5");

        expect(updateSettings).toHaveBeenCalledWith(5);
        expect(el.textContent).toContain("Seuil enregistré.");
    });

    it("should refuse a negative threshold", async () => {
        await render();

        await typeAndSubmit("-2");

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Indiquez un nombre entier positif ou nul.");
    });

    it("should leave the field empty when no threshold exists yet", async () => {
        await render(false, null);

        expect(input().value).toBe("");
        expect(el.textContent).toContain("Aucun seuil général n'est encore défini.");
    });

    it("should refuse a decimal threshold", async () => {
        await render();

        await typeAndSubmit("2.5");

        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("should offer to retry when loading fails", async () => {
        await render(true);

        expect(el.textContent).toContain("Impossible de charger le seuil d'alerte.");
        expect(input()).toBeNull();
    });

    it("should ask before leaving with unsaved changes", async () => {
        await render();

        input().value = "7";
        input().dispatchEvent(new Event("input"));
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

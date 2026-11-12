import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { StockMovementService } from "../../../core/stock/stock-movement.service";
import { ExportService } from "./export.service";
import { SettingsExport } from "./settings-export";

describe("SettingsExport", () => {
    let fixture: ComponentFixture<SettingsExport>;
    let el: HTMLElement;
    let productsCsv: ReturnType<typeof vi.fn>;
    let salesCsv: ReturnType<typeof vi.fn>;
    let exportCsv: ReturnType<typeof vi.fn>;
    let click: ReturnType<typeof vi.fn>;

    async function render(salesError?: HttpErrorResponse) {
        const file = new Blob(["a;b"]);
        productsCsv = vi.fn(() => of(file));
        salesCsv = vi.fn(() => (salesError ? throwError(() => salesError) : of(file)));
        exportCsv = vi.fn(() => of(file));

        // jsdom ne sait pas créer d'adresse de fichier ni cliquer sur un lien de téléchargement
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        await TestBed.configureTestingModule({
            imports: [SettingsExport],
            providers: [
                provideRouter([]),
                { provide: ExportService, useValue: { productsCsv, salesCsv } },
                { provide: StockMovementService, useValue: { exportCsv } },
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

        fixture = TestBed.createComponent(SettingsExport);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>(".export-item > .btn")];

    afterEach(() => vi.restoreAllMocks());

    it("should offer the three exports", async () => {
        await render();

        expect(buttons()).toHaveLength(3);
        expect(el.textContent).toContain("Produits");
        expect(el.textContent).toContain("Ventes");
        expect(el.textContent).toContain("Mouvements de stock");
    });

    it("should download the products", async () => {
        await render();

        buttons()[0].click();
        await fixture.whenStable();

        expect(productsCsv).toHaveBeenCalled();
        expect(click).toHaveBeenCalled();
    });

    it("should export every sale when no period is chosen", async () => {
        await render();

        buttons()[1].click();
        await fixture.whenStable();

        expect(salesCsv).toHaveBeenCalledWith(null, null);
    });

    it("should download the stock movements without any filter", async () => {
        await render();

        buttons()[2].click();
        await fixture.whenStable();

        expect(exportCsv).toHaveBeenCalledWith({
            from: null,
            to: null,
            type: null,
            productId: null,
        });
    });

    it("should tell the owner to reduce the period when there are too many sales", async () => {
        await render(new HttpErrorResponse({ status: 413 }));

        buttons()[1].click();
        await fixture.whenStable();

        expect(el.textContent).toContain("réduisez la période");
        expect(click).not.toHaveBeenCalled();
    });

    it("should show a generic error under the failing export only", async () => {
        await render(new HttpErrorResponse({ status: 500 }));

        buttons()[1].click();
        await fixture.whenStable();

        const alerts = el.querySelectorAll(".export-alert");
        expect(alerts).toHaveLength(1);
        expect(alerts[0].textContent).toContain("Impossible d'exporter les ventes.");
    });
});

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
    let productsFile: ReturnType<typeof vi.fn>;
    let salesFile: ReturnType<typeof vi.fn>;
    let exportFile: ReturnType<typeof vi.fn>;
    let click: ReturnType<typeof vi.fn>;

    async function render(salesError?: HttpErrorResponse) {
        const file = new Blob(["a;b"]);
        productsFile = vi.fn(() => of(file));
        salesFile = vi.fn(() => (salesError ? throwError(() => salesError) : of(file)));
        exportFile = vi.fn(() => of(file));

        // jsdom ne sait pas créer d'adresse de fichier ni cliquer sur un lien de téléchargement
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        await TestBed.configureTestingModule({
            imports: [SettingsExport],
            providers: [
                provideRouter([]),
                { provide: ExportService, useValue: { productsFile, salesFile } },
                { provide: StockMovementService, useValue: { exportFile } },
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

        fixture = TestBed.createComponent(SettingsExport);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const menus = () => [...el.querySelectorAll<HTMLElement>(".export-item > app-export-menu")];

    // ouvre le menu de la ligne puis choisit le format
    function pick(index: number, format: "pdf" | "csv" = "pdf") {
        menus()[index].querySelector<HTMLButtonElement>(".trigger")!.click();
        fixture.detectChanges();
        menus()
            [index].querySelectorAll<HTMLButtonElement>(".item")
            [format === "pdf" ? 0 : 1].click();
    }

    afterEach(() => vi.restoreAllMocks());

    it("should offer the three exports", async () => {
        await render();

        expect(menus()).toHaveLength(3);
        expect(el.textContent).toContain("Produits");
        expect(el.textContent).toContain("Ventes");
        expect(el.textContent).toContain("Mouvements de stock");
    });

    it("should download the products", async () => {
        await render();

        pick(0);
        await fixture.whenStable();

        expect(productsFile).toHaveBeenCalled();
        expect(click).toHaveBeenCalled();
    });

    it("should export every sale when no period is chosen", async () => {
        await render();

        pick(1, "csv");
        await fixture.whenStable();

        expect(salesFile).toHaveBeenCalledWith(null, null, "csv");
    });

    it("should download the stock movements without any filter", async () => {
        await render();

        pick(2);
        await fixture.whenStable();

        expect(exportFile).toHaveBeenCalledWith(
            { from: null, to: null, type: null, productId: null },
            "pdf",
        );
    });

    it("should tell the owner to reduce the period when there are too many sales", async () => {
        await render(new HttpErrorResponse({ status: 413 }));

        pick(1);
        await fixture.whenStable();

        expect(el.textContent).toContain("réduisez la période");
        expect(click).not.toHaveBeenCalled();
    });

    it("should show a generic error under the failing export only", async () => {
        await render(new HttpErrorResponse({ status: 500 }));

        pick(1);
        await fixture.whenStable();

        const alerts = el.querySelectorAll(".export-alert");
        expect(alerts).toHaveLength(1);
        expect(alerts[0].textContent).toContain("Impossible d'exporter les ventes.");
    });
});

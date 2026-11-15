import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { StockMovements } from "./stock-movements";
import { AuthService } from "../../core/auth/auth.service";
import { StockMovement, StockMovementFilters } from "../../core/stock/stock-movement.model";
import { StockMovementService } from "../../core/stock/stock-movement.service";

const movement = (
    id: number,
    type: StockMovement["type"],
    referenceId: number | null = 8,
): StockMovement => ({
    id,
    product_id: 3,
    product_name: "Bazin riche bleu",
    type,
    quantity: 4,
    user_id: 1,
    user_name: "Admin Test",
    reference_type: type === "ENTRY" ? "stock_entry" : "sale",
    reference_id: referenceId,
    sale_number: referenceId === null ? null : referenceId + 100,
    stock_after: 10,
    created_at: "2026-11-02T10:15:00",
});

const counters = {
    movements: 3,
    incoming: 2,
    outgoing: 1,
    entries: 1,
    entry_units: 20,
    sales: 1,
    sale_units: 4,
    adjustments: 1,
    adjustment_units: 4,
    inventory_adjustments: 0,
    inventory_units: 0,
    manual_adjustments: 0,
    manual_units: 0,
};

describe("StockMovements", () => {
    let fixture: ComponentFixture<StockMovements>;
    let el: HTMLElement;
    let getMovements: ReturnType<typeof vi.fn>;
    let exportFile: ReturnType<typeof vi.fn>;

    async function render(options: {
        isAdmin?: boolean;
        movements?: StockMovement[];
        productId?: string;
        adjust?: boolean;
        error?: string;
    }) {
        const { isAdmin = true, productId, adjust = false, error } = options;
        const movements = options.movements ?? [
            movement(3, "SALE"),
            movement(2, "ADJUSTMENT"),
            movement(1, "ENTRY", 5),
        ];

        getMovements = vi.fn((filters: StockMovementFilters) =>
            error
                ? throwError(
                      () => new HttpErrorResponse({ status: 404, error: { message: error } }),
                  )
                : of({ data: movements, total: movements.length, counters, filters }),
        );
        exportFile = vi.fn(() => of(new Blob(["a"])));
        globalThis.IntersectionObserver = class {
            observe() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;

        await TestBed.configureTestingModule({
            imports: [StockMovements],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap(productId ? { productId } : {}),
                        },
                        queryParamMap: of(convertToParamMap(adjust ? { adjust: "1" } : {})),
                    },
                },
                { provide: StockMovementService, useValue: { getMovements, exportFile } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StockMovements);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should offer the stock adjustment to the admin only", async () => {
        await render({});
        expect(el.querySelector(".adjust-btn")).not.toBeNull();
    });

    it("should hide the stock adjustment from the manager", async () => {
        await render({ isAdmin: false });
        expect(el.querySelector(".adjust-btn")).toBeNull();
    });

    it("should show the reason of a manual adjustment", async () => {
        const manual = { ...movement(4, "MANUAL_LOSS", null), reference_type: "breakage" };
        await render({ movements: [manual] });

        expect(el.textContent).toContain("Endommagé");
    });

    it("should load the first page with the totals of the backend", async () => {
        await render({});

        expect(getMovements).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 20, type: null, productId: null }),
        );
        const stats = el.querySelectorAll(".stat");
        expect(stats.length).toBe(6);
        expect(stats[1].textContent).toContain("Entrées");
        expect(stats[1].textContent).toContain("20 unités");
        expect(stats[2].textContent).toContain("4 unités");
    });

    it("should show the sign of each movement and link sales", async () => {
        await render({});

        const rows = el.querySelectorAll("tbody tr");
        expect(rows.length).toBe(3);
        expect(rows[0].textContent).toContain("Vente");
        expect(rows[0].textContent).toContain("−4");
        expect(rows[1].textContent).toContain("Remboursement");
        expect(rows[1].textContent).toContain("+4");
        expect(rows[2].textContent).toContain("Entrée de stock");

        const saleLink = rows[0].querySelector<HTMLAnchorElement>(".sale-link")!;
        expect(saleLink.getAttribute("href")).toBe("/sales/8");
        // une entrée n'a pas de fiche, pas de lien
        expect(rows[2].querySelector(".sale-link")).toBeNull();
    });

    it("should filter by type from the counters", async () => {
        await render({});

        el.querySelectorAll<HTMLButtonElement>(".stat")[2].click();
        await fixture.whenStable();

        expect(getMovements).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "SALE", page: 1 }),
        );
    });

    it("should filter by type from the chips of the phone", async () => {
        await render({});

        el.querySelectorAll<HTMLButtonElement>(".type-chip")[2].click();
        await fixture.whenStable();

        expect(getMovements).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "OUT", page: 1 }),
        );
    });

    it("should hide the author column from the manager", async () => {
        await render({ isAdmin: false, movements: [movement(3, "SALE", null)] });

        expect(el.textContent).not.toContain("Par");
        expect(el.textContent).not.toContain("Admin Test");
        expect(el.querySelector("td .origin")?.textContent).toContain("Vente");
        expect(el.textContent).not.toContain("autre vendeur");
        expect(el.querySelector(".sale-link")).toBeNull();
    });

    it("should filter on the product of the address and let the user remove it", async () => {
        await render({ productId: "3" });

        expect(getMovements).toHaveBeenCalledWith(expect.objectContaining({ productId: 3 }));
        const chip = el.querySelector<HTMLButtonElement>(".product-filter")!;
        expect(chip.textContent).toContain("Bazin riche bleu");

        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
        chip.click();
        await fixture.whenStable();

        expect(getMovements).toHaveBeenLastCalledWith(expect.objectContaining({ productId: null }));
        expect(navigate).toHaveBeenCalled();
    });

    it("should show the backend message and a way out for an unknown product", async () => {
        await render({ productId: "99", error: "Produit introuvable." });

        expect(el.textContent).toContain("Produit introuvable.");
        expect(el.textContent).toContain("Voir tous les mouvements");
    });

    it("should say when there is no movement yet", async () => {
        await render({ movements: [] });
        expect(el.textContent).toContain("Aucun mouvement pour le moment.");
        expect(el.querySelector("a[href='/stock-entries']")).not.toBeNull();
    });

    it("should not offer the stock entry to the manager when empty", async () => {
        await render({ isAdmin: false, movements: [] });
        expect(el.querySelector("a[href='/stock-entries']")).toBeNull();
    });

    it("should hide the export from the manager", async () => {
        await render({ isAdmin: false });
        expect(el.querySelector("app-export-menu")).toBeNull();
    });

    it("should show the export to the admin", async () => {
        await render({});
        expect(el.querySelector("app-export-menu")).not.toBeNull();
    });

    it("should show the stock after each movement", async () => {
        await render({});

        const cells = el.querySelectorAll("tbody td.stock-after");
        expect(cells.length).toBe(3);
        expect(cells[0].textContent).toContain("10");
    });

    function pickExport(format: "pdf" | "csv") {
        el.querySelector<HTMLButtonElement>("app-export-menu .trigger")!.click();
        fixture.detectChanges();
        el.querySelectorAll<HTMLButtonElement>("app-export-menu .item")[
            format === "pdf" ? 0 : 1
        ].click();
    }

    it("should export with the filters of the page", async () => {
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        await render({ productId: "3" });

        pickExport("pdf");
        await fixture.whenStable();

        expect(exportFile).toHaveBeenCalledWith(
            expect.objectContaining({ productId: 3, type: null }),
            "pdf",
        );
    });

    it("should tell when the export fails", async () => {
        await render({});
        exportFile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

        pickExport("csv");
        await fixture.whenStable();

        expect(el.textContent).toContain("Impossible d'exporter les mouvements.");
    });

    it("should open the sale page when a sale row is clicked", async () => {
        await render({});
        HTMLDialogElement.prototype.showModal = vi.fn();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate");

        el.querySelectorAll<HTMLElement>("tbody tr")[0].click();
        await fixture.whenStable();

        expect(navigate).toHaveBeenCalledWith(["/sales", 8], expect.anything());
        expect(el.querySelector(".detail")!.textContent).not.toContain("Mouvement n° 3");
    });

    it("should open the movement detail when a stock entry row is clicked", async () => {
        await render({});
        HTMLDialogElement.prototype.showModal = vi.fn();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate");

        el.querySelectorAll<HTMLElement>("tbody tr")[2].click();
        await fixture.whenStable();

        const detail = el.querySelector(".detail")!;
        expect(detail.textContent).toContain("Mouvement n° 1");
        expect(detail.textContent).toContain("en stock");
        expect(navigate).not.toHaveBeenCalled();
    });

    it("should group the movements by day with Aujourd'hui and Hier labels", async () => {
        const at = (daysAgo: number, hour: number) => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            date.setHours(hour, 30, 0, 0);
            return date.toISOString();
        };
        const list = [
            { ...movement(4, "SALE"), created_at: at(0, 11) },
            { ...movement(3, "SALE"), created_at: at(0, 9) },
            { ...movement(2, "ENTRY", 5), created_at: at(1, 15) },
            { ...movement(1, "ENTRY", 6), created_at: at(5, 10) },
        ];
        await render({ movements: list });

        const days = [...el.querySelectorAll(".day")];
        expect(days.length).toBe(3);
        expect(days[0].querySelector(".day-title")?.textContent).toContain("Aujourd'hui");
        expect(days[0].querySelectorAll(".movement-row").length).toBe(2);
        expect(days[1].querySelector(".day-title")?.textContent).toContain("Hier");
        expect(days[1].querySelectorAll(".movement-row").length).toBe(1);
        expect(days[2].querySelector(".day-title")?.textContent).not.toMatch(/Aujourd'hui|Hier/);
    });

    it("should color the quantity by sign on the phone list", async () => {
        await render({
            movements: [
                movement(3, "SALE"),
                movement(2, "ADJUSTMENT"),
                movement(1, "MANUAL_LOSS", null),
            ],
        });

        const quantities = el.querySelectorAll(".movement-row .quantity");
        expect(quantities[0].classList).toContain("out");
        expect(quantities[0].textContent).toContain("−4");
        expect(quantities[1].classList).toContain("in");
        expect(quantities[1].textContent).toContain("+4");
        expect(quantities[2].classList).toContain("out");
    });

    it("should color the quantity by sign in the table", async () => {
        await render({ movements: [movement(2, "ENTRY", 5), movement(1, "SALE")] });

        const quantities = el.querySelectorAll("td.quantity");
        expect(quantities[0].classList).toContain("in");
        expect(quantities[0].classList).not.toContain("out");
        expect(quantities[1].classList).toContain("out");
    });

    it("should link the sale without author on the phone list for the manager", async () => {
        await render({ isAdmin: false, movements: [movement(3, "SALE", 8)] });

        const row = el.querySelector(".movement-row")!;
        expect(row.textContent).not.toContain("Admin Test");
        expect(row.querySelector(".sale-link")?.textContent).toContain("Vente #108");
    });

    it("should only offer All and Outgoing chips to the manager", async () => {
        await render({ isAdmin: false });

        const labels = [...el.querySelectorAll(".type-chip")].map(
            (chip) => chip.textContent!.trim().split(" ")[0],
        );
        expect(labels).toEqual(["Tous", "Sorties"]);
    });

    it("should offer All, Incoming and Outgoing chips with counters to the admin", async () => {
        await render({});

        const chips = [...el.querySelectorAll(".type-chip")].map((chip) =>
            chip.textContent!.trim().replace(/\s+/g, " "),
        );
        expect(chips).toEqual(["Tous 3", "Entrées 2", "Sorties 1"]);
    });

    it("should open the filters sheet and filter by precise type", async () => {
        await render({});
        expect(el.querySelector(".filters.open")).toBeNull();

        el.querySelector<HTMLButtonElement>(".filter-btn")!.click();
        fixture.detectChanges();
        expect(el.querySelector(".filters.open")).not.toBeNull();

        const options = el.querySelectorAll<HTMLButtonElement>(
            "[aria-label='Type précis'] .type-options .chip",
        );
        expect(options.length).toBe(5);

        options[1].click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(getMovements).toHaveBeenLastCalledWith(expect.objectContaining({ type: "SALE" }));
        // le type précis devient une puce retirable sous la ligne du haut
        const active = el.querySelector<HTMLButtonElement>(".active-chip")!;
        expect(active.textContent).toContain("Ventes");
        expect(el.querySelector(".filter-count")?.textContent).toContain("1");

        active.click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(getMovements).toHaveBeenLastCalledWith(expect.objectContaining({ type: null }));
        expect(el.querySelector(".active-chip")).toBeNull();
    });

    it("should show the chosen direction as an active filter", async () => {
        await render({});

        el.querySelectorAll<HTMLButtonElement>(".type-chip")[1].click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(el.querySelector(".active-chip")?.textContent).toContain("Entrées");
    });

    it("should reset the period and the type from the sheet", async () => {
        await render({});

        el.querySelectorAll<HTMLButtonElement>(".type-options .chip")[1].click();
        await fixture.whenStable();
        fixture.detectChanges();

        el.querySelector<HTMLButtonElement>(".sheet-foot .btn-outline")!.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(getMovements).toHaveBeenLastCalledWith(expect.objectContaining({ type: null }));
        expect(el.querySelector(".active-chip")).toBeNull();
    });

    it("should export from the header menu of the phone", async () => {
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        await render({});

        el.querySelector<HTMLButtonElement>(".head-menu .more-btn")!.click();
        fixture.detectChanges();
        el.querySelectorAll<HTMLButtonElement>(".head-menu .menu button")[1].click();

        expect(exportFile).toHaveBeenCalledWith(expect.anything(), "csv");
    });

    it("should show the type of each movement", async () => {
        await render({
            movements: [movement(1, "ENTRY", null), movement(2, "SALE", 5)],
        });

        expect(el.querySelectorAll(".movement-row .type-pill").length).toBe(2);
    });

    it("should compute the net of the day with the sign of each movement", async () => {
        // entrée +4, vente -4, vente -4, remboursement +4, perte manuelle -4
        await render({
            movements: [
                movement(5, "ENTRY", 5),
                movement(4, "SALE"),
                movement(3, "SALE"),
                movement(2, "ADJUSTMENT"),
                movement(1, "MANUAL_LOSS", null),
            ],
        });

        expect(fixture.componentInstance.days()[0].net).toBe(-4);
    });

    it("should compute a positive net for a day of entries", async () => {
        await render({ movements: [movement(2, "ENTRY", 5), movement(1, "ENTRY", 6)] });

        expect(fixture.componentInstance.days()[0].net).toBe(8);
    });

    it("should show the author on the phone list for the admin", async () => {
        await render({});
        expect(el.querySelector(".movement-row")?.textContent).toContain("Admin Test");
    });

    it("should hide the adjust link of the list from the manager", async () => {
        await render({ isAdmin: false });
        expect(el.querySelector(".adjust-link")).toBeNull();
    });

    it("should have the title Mouvements", async () => {
        await render({});
        expect(el.querySelector("app-page-header")?.getAttribute("title")).toBe("Mouvements");
    });

    it("should offer all dates when a period gives no result and reload without period", async () => {
        await render({});

        getMovements.mockImplementation((filters: StockMovementFilters) =>
            of({ data: [], total: 0, counters, filters }),
        );
        fixture.componentInstance.selectRange({
            period: "today",
            from: "2026-11-13",
            to: "2026-11-13",
        });
        await fixture.whenStable();

        expect(el.textContent).toContain("Aucun mouvement pour ces filtres.");
        const button = [...el.querySelectorAll<HTMLButtonElement>(".empty button")].find((b) =>
            b.textContent?.includes("Toutes les dates"),
        );
        expect(button).toBeDefined();

        button!.click();
        await fixture.whenStable();

        expect(fixture.componentInstance.range().period).toBe("all");
    });

    it("should not offer all dates when no period is set", async () => {
        await render({ movements: [] });
        expect(el.querySelector(".empty")?.textContent).not.toContain("Toutes les dates");
    });
});

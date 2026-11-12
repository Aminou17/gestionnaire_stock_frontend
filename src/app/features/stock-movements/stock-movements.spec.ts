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
    stock_after: 10,
    created_at: "2026-11-02T10:15:00",
});

const counters = {
    movements: 3,
    entries: 1,
    entry_units: 20,
    sales: 1,
    sale_units: 4,
    adjustments: 1,
    adjustment_units: 4,
};

describe("StockMovements", () => {
    let fixture: ComponentFixture<StockMovements>;
    let el: HTMLElement;
    let getMovements: ReturnType<typeof vi.fn>;
    let exportCsv: ReturnType<typeof vi.fn>;

    async function render(options: {
        isAdmin?: boolean;
        movements?: StockMovement[];
        productId?: string;
        error?: string;
    }) {
        const { isAdmin = true, productId, error } = options;
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
        exportCsv = vi.fn(() => of(new Blob(["a"])));
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
                    },
                },
                { provide: StockMovementService, useValue: { getMovements, exportCsv } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StockMovements);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should load the first page with the totals of the backend", async () => {
        await render({});

        expect(getMovements).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 20, type: null, productId: null }),
        );
        const stats = el.querySelectorAll(".stat");
        expect(stats.length).toBe(4);
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

    it("should hide the author column from the manager", async () => {
        await render({ isAdmin: false, movements: [movement(3, "SALE", null)] });

        expect(el.textContent).not.toContain("Par");
        expect(el.textContent).not.toContain("Admin Test");
        expect(el.textContent).toContain("Vente d'un autre vendeur");
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
        expect(el.textContent).toContain("Aucun mouvement de stock pour le moment.");
    });

    it("should show the stock after each movement", async () => {
        await render({});

        const cells = el.querySelectorAll("tbody td.stock-after");
        expect(cells.length).toBe(3);
        expect(cells[0].textContent).toContain("10");
    });

    it("should export with the filters of the page", async () => {
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        await render({ productId: "3" });

        el.querySelector<HTMLButtonElement>(".export")!.click();
        await fixture.whenStable();

        expect(exportCsv).toHaveBeenCalledWith(
            expect.objectContaining({ productId: 3, type: null }),
        );
    });

    it("should tell when the export fails", async () => {
        await render({});
        exportCsv.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

        el.querySelector<HTMLButtonElement>(".export")!.click();
        await fixture.whenStable();

        expect(el.textContent).toContain("Impossible d'exporter les mouvements.");
    });

    it("should open the movement detail instead of the product when a row is clicked", async () => {
        await render({});
        HTMLDialogElement.prototype.showModal = vi.fn();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate");

        el.querySelectorAll<HTMLElement>("tbody tr")[0].click();
        await fixture.whenStable();

        const detail = el.querySelector(".detail")!;
        expect(detail.textContent).toContain("Mouvement n° 3");
        expect(detail.textContent).toContain("Stock avant");
        // vente de 4 qui laisse 10 : il y en avait 14
        expect(detail.textContent).toContain("14");
        expect(navigate).not.toHaveBeenCalled();
    });
});

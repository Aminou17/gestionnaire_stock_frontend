import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { ProductMovements } from "./product-movements";
import { StockMovement } from "../../../core/stock/stock-movement.model";
import { StockMovementService } from "../../../core/stock/stock-movement.service";

const movement = (
    id: number,
    type: StockMovement["type"],
    referenceId: number | null = 8,
): StockMovement => ({
    id,
    product_id: 3,
    product_name: "Bazin riche bleu",
    type,
    quantity: 2,
    reference_type: type === "ENTRY" ? "stock_entry" : "sale",
    reference_id: referenceId,
    stock_after: 10,
    created_at: "2026-11-02T10:15:00",
});

describe("ProductMovements", () => {
    let fixture: ComponentFixture<ProductMovements>;
    let el: HTMLElement;
    let getMovements: ReturnType<typeof vi.fn>;

    async function render(movements: StockMovement[] | "error", total = 12) {
        getMovements = vi.fn(() =>
            movements === "error"
                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                : of({ data: movements, total, counters: {} }),
        );

        await TestBed.configureTestingModule({
            imports: [ProductMovements],
            providers: [
                provideRouter([]),
                { provide: StockMovementService, useValue: { getMovements } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ProductMovements);
        fixture.componentRef.setInput("productId", 3);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    it("should ask the last 5 movements of the product", async () => {
        await render([]);
        expect(getMovements).toHaveBeenCalledWith(
            expect.objectContaining({ productId: 3, page: 1, limit: 5, type: null }),
        );
    });

    it("should show the sign of each movement and link to the full history", async () => {
        await render([movement(1, "SALE"), movement(2, "ENTRY"), movement(3, "ADJUSTMENT")]);

        const text = el.textContent ?? "";
        expect(text).toContain("Vente");
        expect(text).toContain("−2");
        expect(text).toContain("Entrée");
        expect(text).toContain("Remboursement");
        expect(text).toContain("Vente #8");

        const all = el.querySelector<HTMLAnchorElement>(".card-header a")!;
        expect(all.textContent).toContain("Tout voir (12)");
        expect(all.getAttribute("href")).toBe("/stock-movements?productId=3");
    });

    it("should not link a sale hidden by the backend", async () => {
        await render([movement(1, "SALE", null)]);
        expect(el.textContent).not.toContain("Vente #");
    });

    it("should say when the product has no movement", async () => {
        await render([], 0);
        expect(el.textContent).toContain("Aucun mouvement pour ce produit.");
        expect(el.querySelector(".card-header a")).toBeNull();
    });

    it("should offer to retry when loading fails", async () => {
        await render("error");
        expect(el.textContent).toContain("Impossible de charger les mouvements.");
        el.querySelector<HTMLButtonElement>(".empty button")!.click();
        await fixture.whenStable();
        expect(getMovements).toHaveBeenCalledTimes(2);
    });
});

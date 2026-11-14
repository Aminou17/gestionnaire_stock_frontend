import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";

import { MovementDetail } from "./movement-detail";
import { AuthService } from "../../../core/auth/auth.service";
import { StockMovement } from "../../../core/stock/stock-movement.model";

const movement = (
    type: StockMovement["type"],
    referenceId: number | null,
    referenceType = "sale",
): StockMovement => ({
    id: 7,
    product_id: 3,
    product_name: "Bazin riche bleu",
    type,
    quantity: 4,
    user_id: 1,
    user_name: "Admin Test",
    reference_type: referenceType,
    reference_id: referenceId,
    sale_number: referenceId === null ? null : referenceId + 100,
    stock_after: 10,
    created_at: "2026-11-02T10:15:00",
});

describe("MovementDetail", () => {
    let fixture: ComponentFixture<MovementDetail>;
    let el: HTMLElement;

    async function render(item: StockMovement, isAdmin = true) {
        await TestBed.configureTestingModule({
            imports: [MovementDetail],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: { isAdmin: signal(isAdmin) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MovementDetail);
        fixture.componentRef.setInput("movement", item);
        fixture.componentRef.setInput("backState", {
            backTo: "/stock-movements",
            backLabel: "Mouvements",
        });
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const origins = () =>
        [...el.querySelectorAll("dt")].filter((dt) => dt.textContent?.trim() === "Origine");

    it("should show the stock before and after a sale", async () => {
        await render(movement("SALE", 8));

        const change = el.querySelector(".change-stock")!;
        expect(change.textContent).toContain("14");
        expect(change.textContent).toContain("10");
        expect(fixture.componentInstance.stockBefore()).toBe(14);
    });

    it("should compute the stock before an entry by removing the quantity", async () => {
        await render(movement("ENTRY", 5, "stock_entry"));
        expect(fixture.componentInstance.stockBefore()).toBe(6);
    });

    it("should show a single Origine line for a sale", async () => {
        await render(movement("SALE", 8));

        expect(origins().length).toBe(1);
        expect(el.querySelector("dl")?.textContent).toContain("Vente #108");
    });

    it("should show a single Origine line for an inventory", async () => {
        await render(movement("INVENTORY_GAIN", 12, "inventory"));

        expect(origins().length).toBe(1);
        expect(el.querySelector("dl")?.textContent).toContain("Inventaire #12");
    });

    it("should show the reason and no Origine line for a manual adjustment", async () => {
        await render(movement("MANUAL_LOSS", null, "breakage"));

        expect(origins().length).toBe(0);
        expect(el.querySelector("dl")?.textContent).toContain("Motif");
        expect(el.querySelector("dl")?.textContent).toContain("Endommagé");
    });

    it("should show no Origine line for a stock entry", async () => {
        await render(movement("ENTRY", 5, "stock_entry"));
        expect(origins().length).toBe(0);
    });

    it("should hide the author from the manager", async () => {
        await render(movement("SALE", 8), false);
        expect(el.querySelector("dl")?.textContent).not.toContain("Admin Test");
    });
});

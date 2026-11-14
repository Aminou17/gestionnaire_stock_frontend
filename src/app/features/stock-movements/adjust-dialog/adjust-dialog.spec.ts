import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { AdjustDialog } from "./adjust-dialog";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { StockMovementService } from "../../../core/stock/stock-movement.service";

const product = { id: 3, name: "Bazin riche bleu", theoretical_stock: 10 } as Product;

describe("AdjustDialog", () => {
    let fixture: ComponentFixture<AdjustDialog>;
    let component: AdjustDialog;
    let adjustStock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        adjustStock = vi.fn().mockReturnValue(of({ id: 1, stock_after: 8 }));

        await TestBed.configureTestingModule({
            imports: [AdjustDialog],
            providers: [
                { provide: StockMovementService, useValue: { adjustStock } },
                {
                    provide: ProductService,
                    useValue: { getProducts: () => of({ data: [product], total: 1 }) },
                },
            ],
        }).compileComponents();

        // jsdom ne connaît pas showModal
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        fixture = TestBed.createComponent(AdjustDialog);
        component = fixture.componentInstance;
        fixture.detectChanges();
        component.show(product);
        component.setDirection("loss");
        fixture.detectChanges();
    });

    it("should leave the direction to the user", () => {
        component.show(product);

        expect(component.direction()).toBeNull();
        expect(component.canSubmit()).toBe(false);
    });

    it("should not allow saving before the quantity and the reason are filled", () => {
        expect(component.canSubmit()).toBe(false);

        component.setQuantity("2");
        expect(component.canSubmit()).toBe(false);

        component.reason.set("breakage");
        expect(component.canSubmit()).toBe(true);
    });

    it("should accept a note alone and send it with the reason other", () => {
        component.setQuantity("2");
        component.note.set("2 pagnes wax tachés");
        expect(component.canSubmit()).toBe(true);

        component.submit();
        expect(adjustStock).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "other", note: "2 pagnes wax tachés" }),
        );
    });

    it("should refuse a loss bigger than the stock", () => {
        component.setQuantity("11");
        component.reason.set("breakage");

        expect(component.tooMany()).toBe(true);
        expect(component.canSubmit()).toBe(false);
    });

    it("should compute the stock after a loss and after a gain", () => {
        component.setQuantity("3");
        expect(component.stockAfter()).toBe(7);

        component.setDirection("gain");
        expect(component.stockAfter()).toBe(13);
    });

    it("should reset the reason when the direction changes", () => {
        component.reason.set("breakage");
        component.setDirection("gain");

        expect(component.reason()).toBe("");
    });

    it("should change the quantity with the plus and minus buttons, never below 1", () => {
        component.step(-1);
        expect(component.quantity()).toBe(1);

        component.step(1);
        component.step(1);
        expect(component.quantity()).toBe(3);

        component.step(-1);
        expect(component.quantity()).toBe(2);
    });

    it("should say on the button what is going to happen", () => {
        expect(component.submitLabel()).toBe("Retirer du stock");

        component.setQuantity("4");
        expect(component.submitLabel()).toBe("Retirer 4 du stock");

        component.setDirection("gain");
        expect(component.submitLabel()).toBe("Ajouter 4 au stock");
    });

    it("should explain what is missing while the button is disabled", () => {
        expect(component.missing()).toBe("Indiquez la quantité");

        component.setQuantity("2");
        expect(component.missing()).toBe("Choisissez un motif ou écrivez une note");

        component.reason.set("breakage");
        expect(component.missing()).toBe("");
    });

    it("should ask for a direction first and say nothing when the loss is too big", () => {
        component.show(product);
        expect(component.missing()).toBe("Dites si vous retirez ou ajoutez du stock");

        component.setDirection("loss");
        component.setQuantity("11");
        component.reason.set("breakage");
        expect(component.missing()).toBe("");
    });

    it("should show the help text above the disabled button", () => {
        component.setQuantity("2");
        fixture.detectChanges();

        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector(".hint")?.textContent).toContain("Choisissez un motif");
        expect(el.querySelector<HTMLButtonElement>(".submit")!.disabled).toBe(true);

        component.reason.set("breakage");
        fixture.detectChanges();

        expect(el.querySelector(".hint")).toBeNull();
        expect(el.querySelector<HTMLButtonElement>(".submit")!.disabled).toBe(false);
    });

    it("should explain what is missing while the button is disabled", () => {
        expect(component.missing()).toBe("Indiquez la quantité");

        component.setQuantity("2");
        expect(component.missing()).toBe("Choisissez un motif ou écrivez une note");

        component.reason.set("breakage");
        expect(component.missing()).toBe("");
    });

    it("should ask for a direction first and say nothing when the loss is too big", () => {
        component.show(product);
        expect(component.missing()).toBe("Dites si vous retirez ou ajoutez du stock");

        component.setDirection("loss");
        component.setQuantity("11");
        component.reason.set("breakage");
        expect(component.missing()).toBe("");
    });

    it("should show the help text above the disabled button", () => {
        component.setQuantity("2");
        fixture.detectChanges();

        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector(".hint")?.textContent).toContain("Choisissez un motif");
        expect(el.querySelector<HTMLButtonElement>(".submit")!.disabled).toBe(true);

        component.reason.set("breakage");
        fixture.detectChanges();

        expect(el.querySelector(".hint")).toBeNull();
        expect(el.querySelector<HTMLButtonElement>(".submit")!.disabled).toBe(false);
    });

    it("should send the adjustment and tell the page", () => {
        const saved = vi.fn();
        component.saved.subscribe(saved);

        component.setQuantity("2");
        component.reason.set("breakage");
        component.note.set("  carton tombé ");
        component.submit();

        expect(adjustStock).toHaveBeenCalledWith({
            productId: 3,
            direction: "loss",
            quantity: 2,
            reason: "breakage",
            note: "carton tombé",
        });
        expect(saved).toHaveBeenCalledWith("Stock ajusté : −2 « Bazin riche bleu ».");
    });

    it("should show the message of the backend on error", () => {
        adjustStock.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({ status: 409, error: { message: "Stock insuffisant" } }),
            ),
        );

        component.setQuantity("2");
        component.reason.set("breakage");
        component.submit();
        fixture.detectChanges();

        expect(component.saving()).toBe(false);
        expect(fixture.nativeElement.textContent).toContain("Stock insuffisant");
    });
});

import { HttpErrorResponse } from "@angular/common/http";
import { Component, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { Inventory, InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { InventoryApplyDialog } from "./inventory-apply-dialog";
import { InventoryCancelDialog } from "./inventory-cancel-dialog";
import { InventoryLineDialog } from "./inventory-line-dialog";

const inventory = { id: 7, status: "counted", differenceCount: 3 } as Inventory;

const line = {
    productId: 4,
    productName: "Farine de blé 1 kg",
    actualStock: 37,
} as InventoryItem;

// les trois fenêtres dans un même hôte, pour les ouvrir comme le fait la fiche
@Component({
    imports: [InventoryApplyDialog, InventoryCancelDialog, InventoryLineDialog],
    template: `
        <app-inventory-apply-dialog [inventory]="inventory" (applied)="applied = $event" />
        <app-inventory-cancel-dialog [inventory]="inventory" (cancelled)="cancelled = $event" />
        <app-inventory-line-dialog [inventory]="inventory" (saved)="saved = $event" />
    `,
})
class Host {
    inventory = inventory;
    applied: unknown;
    cancelled: unknown;
    saved: unknown;

    apply = viewChild.required(InventoryApplyDialog);
    cancel = viewChild.required(InventoryCancelDialog);
    lineDialog = viewChild.required(InventoryLineDialog);
}

describe("Inventory dialogs", () => {
    let fixture: ComponentFixture<Host>;
    let host: Host;
    let el: HTMLElement;
    let service: Record<string, ReturnType<typeof vi.fn>>;

    const movements = {
        since: "2026-11-23T10:00:00Z",
        totals: {
            sales: { movements: 8, units: 30 },
            returns: { movements: 0, units: 0 },
            entries: { movements: 1, units: 10 },
            others: { movements: 0, units: 0 },
        },
        productsCount: 4,
        products: [],
    };

    beforeEach(async () => {
        // jsdom ne gère pas <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        service = {
            getMovementsSince: vi.fn(() => of(movements)),
            apply: vi.fn(() =>
                of({ inventory, applied: 3, unchanged: 0, skipped: [], limitedToZero: [] }),
            ),
            cancel: vi.fn(() => of({ inventory })),
            saveItems: vi.fn(() => of({ saved: 1, inventory })),
            removeItem: vi.fn(() => of({ inventory })),
        };

        await TestBed.configureTestingModule({
            imports: [Host],
            providers: [{ provide: InventoryService, useValue: service }],
        }).compileComponents();

        fixture = TestBed.createComponent(Host);
        host = fixture.componentInstance;
        el = fixture.nativeElement;
        fixture.detectChanges();
    });

    const text = (selector: string) =>
        el.querySelector(selector)!.textContent!.replace(/\s+/g, " ");

    describe("correct the stock", () => {
        it("should tell what will change and how many sales happened since the counting", () => {
            host.apply().open();
            fixture.detectChanges();

            const content = text("app-inventory-apply-dialog");
            expect(content).toContain("Le stock de 3 produits sera corrigé");
            expect(content).toContain("8 ventes (30 unités)");
            expect(content).toContain("1 entrée de stock (10 unités)");
            expect(content).not.toContain("remboursement");
        });

        it("should say so when nothing happened since the counting", () => {
            service["getMovementsSince"].mockReturnValue(
                of({
                    ...movements,
                    totals: {
                        sales: { movements: 0, units: 0 },
                        returns: { movements: 0, units: 0 },
                        entries: { movements: 0, units: 0 },
                        others: { movements: 0, units: 0 },
                    },
                }),
            );

            host.apply().open();
            fixture.detectChanges();

            expect(text("app-inventory-apply-dialog")).toContain("Aucune vente ni entrée");
        });

        it("should correct the stock when the button is pressed", () => {
            host.apply().open();
            fixture.detectChanges();

            el.querySelector<HTMLButtonElement>("app-inventory-apply-dialog .btn-primary")!.click();

            expect(service["apply"]).toHaveBeenCalledWith(7);
            expect(host.applied).toMatchObject({ applied: 3 });
        });

        it("should show the refusal inside the window, not on the page", () => {
            service["apply"].mockReturnValue(
                throwError(
                    () =>
                        new HttpErrorResponse({
                            status: 409,
                            error: { message: "Cet inventaire a déjà été appliqué." },
                        }),
                ),
            );
            host.apply().open();
            fixture.detectChanges();

            el.querySelector<HTMLButtonElement>("app-inventory-apply-dialog .btn-primary")!.click();
            fixture.detectChanges();

            expect(
                el.querySelector("app-inventory-apply-dialog [role=alert]")?.textContent,
            ).toContain("déjà été appliqué");
            expect(host.applied).toBeUndefined();
        });
    });

    describe("cancel", () => {
        it("should cancel the inventory after the confirmation", () => {
            host.cancel().open();
            fixture.detectChanges();

            expect(text("app-inventory-cancel-dialog")).toContain("Le stock ne sera pas modifié");
            el.querySelector<HTMLButtonElement>("app-inventory-cancel-dialog .btn-danger")!.click();

            expect(service["cancel"]).toHaveBeenCalledWith(7);
            expect(host.cancelled).toBeDefined();
        });
    });

    describe("correct a line", () => {
        it("should send the new count of the product", () => {
            host.lineDialog().open(line);
            fixture.detectChanges();

            const field = el.querySelector<HTMLInputElement>("app-inventory-line-dialog input")!;
            expect(field.value).toBe("37");

            field.value = "4x2";
            field.dispatchEvent(new Event("input"));
            fixture.detectChanges();
            expect(field.value).toBe("42");

            el.querySelector<HTMLButtonElement>("app-inventory-line-dialog .btn-primary")!.click();

            expect(service["saveItems"]).toHaveBeenCalledWith(7, [
                { productId: 4, actualStock: 42 },
            ]);
            expect(host.saved).toBeDefined();
        });

        it("should remove the product from the count", () => {
            host.lineDialog().open(line);
            fixture.detectChanges();

            el.querySelector<HTMLButtonElement>("app-inventory-line-dialog .remove")!.click();

            expect(service["removeItem"]).toHaveBeenCalledWith(7, 4);
        });

        it("should not send an empty count", () => {
            host.lineDialog().open({ ...line, actualStock: null });
            fixture.detectChanges();

            const button = el.querySelector<HTMLButtonElement>(
                "app-inventory-line-dialog .btn-primary",
            )!;
            expect(button.disabled).toBe(true);
        });
    });
});

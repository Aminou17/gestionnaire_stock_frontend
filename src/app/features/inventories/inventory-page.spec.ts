import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { Inventory, InventoryDetail, InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { InventoryPage } from "./inventory-page";

const inventory = (changes: Partial<Inventory> = {}): Inventory => ({
    id: 12,
    name: null,
    status: "counted",
    statusLabel: "À valider",
    scope: { type: "all", categoryId: null, categoryName: null },
    startedAt: new Date().toISOString(),
    countedAt: new Date().toISOString(),
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Awa Bazin", avatar: null },
    countedBy: { id: 1, name: "Awa Bazin", avatar: null },
    appliedBy: null,
    cancelledBy: null,
    itemsCount: 34,
    countedCount: 30,
    uncountedCount: 4,
    differenceCount: 12,
    differenceValue: -45000,
    maxStock: 1000000,
    ...changes,
});

const item = (changes: Partial<InventoryItem> = {}): InventoryItem => ({
    id: 1,
    productId: 1,
    productName: "Riz parfumé 5 kg",
    image: null,
    counted: true,
    actualStock: 37,
    countedAt: null,
    theoreticalStock: 38,
    difference: -1,
    purchasePrice: 600,
    differenceValue: -600,
    adjustment: null,
    movementsSince: null,
    expectedStock: null,
    stockBefore: null,
    stockAfter: null,
    applyNote: null,
    ...changes,
});

describe("InventoryPage", () => {
    let fixture: ComponentFixture<InventoryPage>;
    let el: HTMLElement;
    let getInventory: ReturnType<typeof vi.fn>;
    let exportInventory: ReturnType<typeof vi.fn>;

    async function render(
        head: Partial<Inventory> = {},
        items: InventoryItem[] = [item()],
        isAdmin = true,
    ) {
        const detail: InventoryDetail = {
            ...inventory(head),
            items,
            pagination: { page: 1, limit: 25, total: items.length, totalPages: 1 },
        };
        getInventory = vi.fn(() => of(detail));
        exportInventory = vi.fn(() => of(new Blob(["x"])));

        // jsdom ne gère pas <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        await TestBed.configureTestingModule({
            imports: [InventoryPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParamMap: convertToParamMap({}) },
                        paramMap: of(convertToParamMap({ id: "12" })),
                    },
                },
                { provide: InventoryService, useValue: { getInventory, exportInventory } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Test" }),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(InventoryPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
        fixture.detectChanges();
    }

    const text = (node: Element | null = el) => node!.textContent!.replace(/\s+/g, " ").trim();

    it("should tell the admin the result in one sentence and offer to correct the stock", async () => {
        await render();

        expect(text(el.querySelector(".sentence"))).toMatch(
            /^12 produits en écart, perte de 45.000.F$/,
        );
        expect(text(el.querySelector(".btn-main"))).toBe("Corriger le stock");
        expect(text(el.querySelector(".badge-warning"))).toBe("À valider");
    });

    it("should only tell the manager that the counting waits for validation, without money", async () => {
        await render(
            { differenceValue: null },
            [item({ purchasePrice: null, differenceValue: null })],
            false,
        );

        expect(text(el.querySelector(".sentence"))).toBe(
            "Comptage terminé, en attente de validation",
        );
        expect(el.querySelector(".btn-main")).toBeNull();
        expect(el.querySelector("app-action-menu")).toBeNull();
        expect(text(el)).not.toMatch(/\d\sF\b/);
    });

    it("should continue the counting from the page of an open inventory, for both roles", async () => {
        await render({ status: "in_progress", statusLabel: "En cours", differenceCount: null });

        expect(text(el.querySelector(".btn-main"))).toBe("Continuer le comptage");
        expect(el.querySelector(".btn-main")?.getAttribute("href")).toBe("/inventories/12/count");
    });

    it("should keep the theoretical stock hidden while counting, even for the admin", async () => {
        await render({ status: "in_progress", statusLabel: "En cours" });

        expect(text(el)).not.toContain("Attendu");
        expect(text(el.querySelector(".items"))).toContain("Compté 37");
        expect([...el.querySelectorAll(".chip")].map((chip) => text(chip).trim())).toEqual([
            "Tous",
            "Non comptés",
        ]);
    });

    it("should show only the gaps first when the counting is finished", async () => {
        await render();

        expect(getInventory).toHaveBeenLastCalledWith(
            12,
            expect.objectContaining({ filter: "differences" }),
        );
        expect(el.querySelector(".chip[aria-pressed=true]")?.textContent).toContain("Écarts");
        // l'écart est le plus grand chiffre de la ligne
        expect(text(el.querySelector(".gap"))).toBe("−1");
        expect(text(el.querySelector(".items .item"))).toContain("Attendu 38 · Compté 37");
    });

    it("should show every product when there is no gap to look at", async () => {
        await render({ differenceCount: 0, differenceValue: 0 }, [
            item({ difference: 0, differenceValue: 0 }),
        ]);

        expect(getInventory).toHaveBeenLastCalledWith(
            12,
            expect.objectContaining({ filter: "all" }),
        );
        expect(text(el.querySelector(".sentence"))).toBe("Aucun écart");
    });

    it("should let the admin correct a line of an inventory to validate", async () => {
        await render();

        const line = el.querySelector<HTMLButtonElement>(".items button.item");
        expect(line?.getAttribute("aria-label")).toBe("Corriger le comptage de Riz parfumé 5 kg");
    });

    it("should not let the manager correct a line of a closed inventory", async () => {
        await render({}, [item()], false);

        expect(el.querySelector(".items button.item")).toBeNull();
        expect(el.querySelector(".items a.item")).toBeNull();
    });

    it("should send the manager from a line of an open inventory to the counting screen", async () => {
        await render({ status: "in_progress", statusLabel: "En cours" }, [item()], false);

        const link = el.querySelector<HTMLAnchorElement>(".items a.item")!;
        expect(link.getAttribute("href")).toContain("/inventories/12/count");
        expect(link.getAttribute("href")).toContain("q=Riz");
    });

    it("should offer to cancel only before the stock is corrected", async () => {
        await render();
        const ids = () => fixture.componentInstance.menuItems().map((i) => i.id);

        expect(ids()).toEqual(["pdf", "csv", "cancel"]);

        const applied = TestBed.createComponent(InventoryPage);
        applied.componentInstance.inventory.set(inventory({ status: "applied" }));
        expect(applied.componentInstance.menuItems().map((i) => i.id)).toEqual(["pdf", "csv"]);
    });

    it("should explain the detail of a corrected line", async () => {
        await render(
            { status: "applied", statusLabel: "Terminé", appliedAt: new Date().toISOString() },
            [
                item({
                    adjustment: -4,
                    movementsSince: -3,
                    stockBefore: 20,
                    stockAfter: 16,
                    applyNote: "38 à l'ouverture, 3 ventes depuis",
                }),
            ],
        );

        expect(el.querySelector(".btn-main")).toBeNull();
        el.querySelector<HTMLButtonElement>(".items button.item")!.click();
        fixture.detectChanges();

        expect(text(el.querySelector("dl.detail"))).toContain("Stock avant20");
        expect(text(el.querySelector("dl.detail"))).toContain("38 à l'ouverture, 3 ventes depuis");
    });

    it("should report what happened after the stock was corrected, in plain words", async () => {
        await render();

        fixture.componentInstance.onApplied({
            inventory: inventory({ status: "applied", statusLabel: "Terminé" }),
            applied: 9,
            unchanged: 2,
            skipped: [{ productId: 5, productName: "Chemise", reason: "Produit désactivé" }],
            limitedToZero: [{ productId: 6, productName: "Riz", wanted: -10, applied: -2 }],
        });
        fixture.detectChanges();

        const report = text(el.querySelector(".report"));
        expect(report).toContain("9 produits corrigés");
        expect(report).toContain("2 déjà justes");
        expect(report).toContain("Chemise");
        expect(report).toContain("Produit désactivé. Son stock n'a pas été modifié.");
        expect(report).toContain("devait baisser de 10, mais il n'en restait que 2");
        expect(el.querySelector(".alert-error")).toBeNull();
        expect(text(el)).not.toMatch(/Appliqu/);
    });

    it("should warn about an inventory older than one day", async () => {
        await render({ startedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() });

        expect(text(el.querySelector(".alert-warning"))).toContain("il y a 3 jours");
    });

    it("should not warn about a recent inventory", async () => {
        await render();

        expect(el.querySelector(".alert-warning")).toBeNull();
    });

    it("should keep the export error apart from the correction error", async () => {
        await render();
        exportInventory.mockReturnValue(throwError(() => new Error("500")));

        fixture.componentInstance.exportFile("pdf");
        fixture.detectChanges();

        expect(text(el.querySelector(".alert-dismissible"))).toContain("Impossible d'exporter");
        expect(fixture.componentInstance.actionError()).toBe("");
    });

    it("should say when the inventory cannot be found", async () => {
        getInventory = vi.fn(() => throwError(() => ({ status: 404 })));
        await TestBed.configureTestingModule({
            imports: [InventoryPage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "99" })) },
                },
                { provide: InventoryService, useValue: { getInventory } },
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(true), isOwner: signal(false), user: signal({}) },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(InventoryPage);
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain("Impossible de charger cet inventaire");
    });
});

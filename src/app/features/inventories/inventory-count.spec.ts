import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { dbDelete } from "../../core/offline/local-db";
import { NetworkService } from "../../core/offline/network.service";
import { Inventory, InventoryDetail, InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { ToastService } from "../../shared/toast/toast.service";
import { InventoryCount } from "./inventory-count";

const inventory = (changes: Partial<Inventory> = {}): Inventory => ({
    id: 7,
    name: null,
    status: "in_progress",
    statusLabel: "En cours",
    scope: { type: "all", categoryId: null, categoryName: null },
    startedAt: "2026-11-23T10:00:00Z",
    countedAt: null,
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Awa", avatar: null },
    countedBy: null,
    appliedBy: null,
    cancelledBy: null,
    itemsCount: 34,
    countedCount: 3,
    uncountedCount: 31,
    differenceCount: null,
    differenceValue: null,
    maxStock: 1000,
    ...changes,
});

// le serveur envoie le stock théorique à l'admin : l'écran ne doit jamais l'afficher
const item = (id: number, name: string, actual: number | null = null): InventoryItem => ({
    id,
    productId: id,
    productName: name,
    image: null,
    counted: actual !== null,
    actualStock: actual,
    countedAt: null,
    theoreticalStock: 41,
    difference: null,
    purchasePrice: 600,
    differenceValue: null,
    adjustment: null,
    movementsSince: null,
    expectedStock: null,
    stockBefore: null,
    stockAfter: null,
    applyNote: null,
});

const detail = (items: InventoryItem[], changes: Partial<Inventory> = {}): InventoryDetail => ({
    ...inventory(changes),
    items,
    pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 },
});

describe("InventoryCount", () => {
    let fixture: ComponentFixture<InventoryCount>;
    let el: HTMLElement;
    let router: Router;
    let getInventory: ReturnType<typeof vi.fn>;
    let saveItems: ReturnType<typeof vi.fn>;
    let close: ReturnType<typeof vi.fn>;
    const online = signal(true);

    const lines = [
        item(1, "Riz parfumé 5 kg"),
        item(2, "Farine de blé 1 kg"),
        item(3, "Sucre 1 kg"),
    ];

    async function render(first: InventoryDetail = detail(lines), query = {}) {
        await dbDelete("kv", "inventory-draft-7");
        online.set(true);
        getInventory = vi.fn(() => of(first));
        saveItems = vi.fn(() => of({ saved: 1, inventory: inventory({ countedCount: 4 }) }));
        close = vi.fn(() => of({ inventory: inventory({ status: "counted" }) }));

        // jsdom ne gère pas <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        window.scrollTo = vi.fn();
        Element.prototype.scrollIntoView = vi.fn();

        await TestBed.configureTestingModule({
            imports: [InventoryCount],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParamMap: convertToParamMap(query) },
                        paramMap: of(convertToParamMap({ id: "7" })),
                    },
                },
                { provide: NetworkService, useValue: { online } },
                {
                    provide: InventoryService,
                    useValue: { getInventory, saveItems, uncount: vi.fn(), close },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        fixture = TestBed.createComponent(InventoryCount);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = (node: Element | null = el) => node!.textContent!.replace(/\s+/g, " ");
    const inputs = () => [...el.querySelectorAll<HTMLInputElement>("input.count")];

    // laisse finir les scans, qui s'enchaînent en promesses
    const settle = () => new Promise((resolve) => setTimeout(resolve));

    const type = (field: HTMLInputElement, value: string) => {
        field.value = value;
        field.dispatchEvent(new Event("input"));
        fixture.detectChanges();
    };

    it("should show the server counts as the gauge and on the tabs", async () => {
        await render();

        expect(text(el.querySelector(".progress"))).toContain("3 sur 34 comptés");
        const tabs = [...el.querySelectorAll(".tab")].map((tab) => text(tab).trim());
        expect(tabs).toEqual(["À compter 31", "Comptés 3"]);
    });

    it("should never show the theoretical stock while counting", async () => {
        await render();

        expect(text()).not.toContain("Attendu");
        expect(text()).not.toContain("41");
        expect(text()).not.toContain("600");
    });

    it("should count a typed entry in the gauge right away and keep only the digits", async () => {
        await render();

        type(inputs()[0], "1a2");

        expect(inputs()[0].value).toBe("12");
        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 12 });
        expect(text(el.querySelector(".progress"))).toContain("4 sur 34 comptés");
        expect(el.querySelector(".line.counted")).not.toBeNull();
    });

    it("should step with the buttons, start from 0 and stop at 0", async () => {
        await render();
        const plus = el.querySelectorAll<HTMLButtonElement>(".step")[1];

        plus.click();
        plus.click();
        fixture.detectChanges();
        expect(inputs()[0].value).toBe("2");

        const minus = el.querySelectorAll<HTMLButtonElement>(".step")[0];
        minus.click();
        minus.click();
        fixture.detectChanges();
        expect(inputs()[0].value).toBe("0");
        expect(minus.disabled).toBe(true);
    });

    it("should put a product at zero with the explicit 0 button", async () => {
        await render();

        el.querySelector<HTMLButtonElement>(".zero")!.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 0 });
        expect(el.querySelector(".zero")?.getAttribute("aria-pressed")).toBe("true");
    });

    it("should never go over the maximum stock of the server", async () => {
        await render();

        type(inputs()[0], "999999");

        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 1000 });
    });

    it("should move to the next product with Enter", async () => {
        await render();

        inputs()[0].focus();
        inputs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(document.activeElement).toBe(inputs()[1]);
    });

    it("should add 1 for each scan of the same product and put the line forward", async () => {
        await render();
        getInventory.mockReturnValue(of(detail([item(2, "Farine de blé 1 kg")])));

        fixture.componentInstance.onScan("6001");
        fixture.componentInstance.onScan("6001");
        await settle();
        fixture.detectChanges();

        expect(fixture.componentInstance.sync.pending()).toEqual({ 2: 2 });
        expect(text(el.querySelector(".scanned"))).toContain("Farine de blé 1 kg");
        // la liste n'est pas vidée, et le produit scanné n'y figure pas deux fois
        expect(el.querySelectorAll(".lines li").length).toBe(2);
    });

    it("should tell when a scanned product is not in the counting", async () => {
        await render();
        getInventory.mockReturnValue(of(detail([])));
        const toast = TestBed.inject(ToastService);

        fixture.componentInstance.onScan("0000");
        await settle();

        expect(toast.message()).toContain("pas dans ce comptage");
    });

    describe("load more", () => {
        const many = (from: number, to: number) =>
            Array.from({ length: to - from + 1 }, (_, i) => item(from + i, `Produit ${from + i}`));
        const page = (items: InventoryItem[], number: number): InventoryDetail => ({
            ...detail(items),
            pagination: { page: number, limit: 50, total: 80, totalPages: 2 },
        });

        it("should add the next page below the list, 50 products at a time", async () => {
            await render(page(many(1, 50), 1));
            expect(el.querySelectorAll(".lines li").length).toBe(50);

            getInventory.mockReturnValue(of(page(many(51, 80), 2)));
            await fixture.componentInstance.loadMore();
            fixture.detectChanges();

            expect(getInventory).toHaveBeenLastCalledWith(
                7,
                expect.objectContaining({ page: 2, limit: 50 }),
            );
            expect(el.querySelectorAll(".lines li").length).toBe(80);
            expect(text()).not.toContain("Charger plus");
        });

        it("should not skip any product when some were counted since the first page", async () => {
            await render(page(many(1, 50), 1));

            // 12 produits de la première page sont comptés et déjà reçus par le serveur :
            // ils ne sont plus « à compter », la suite de la liste commence 12 lignes plus tôt
            fixture.componentInstance.sync.onSaved(
                inventory({ countedCount: 15 }),
                Object.fromEntries(many(1, 12).map((line) => [line.productId, 3])),
            );

            getInventory.mockReturnValue(of(page(many(39, 68), 1)));
            await fixture.componentInstance.loadMore();

            // 38 lignes sont encore à compter : la page 1 est redemandée, sans doublon
            expect(getInventory).toHaveBeenLastCalledWith(7, expect.objectContaining({ page: 1 }));
            expect(fixture.componentInstance.lines().length).toBe(68);
        });
    });

    it("should leave the counting to the page of the inventory when it is already closed", async () => {
        await render(detail(lines, { status: "counted" }));

        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 7], { replaceUrl: true });
    });

    it("should start from the search of the page that sent us here", async () => {
        await render(detail(lines), { q: "Riz" });

        expect(getInventory).toHaveBeenCalledWith(
            7,
            expect.objectContaining({ search: "Riz", filter: "uncounted" }),
        );
    });

    it("should ask what to do with the products not counted, ignoring them by default", async () => {
        await render();

        await fixture.componentInstance.review();
        fixture.detectChanges();

        expect(text()).toContain("Il reste 31 produits non comptés");
        const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
        expect(radios[0].checked).toBe(true);
        expect(text(el.querySelector(".choices"))).toContain("Les ignorer");
        expect(text(el.querySelector(".choices"))).toContain("Les compter à 0");

        fixture.componentInstance.close();
        expect(close).toHaveBeenCalledWith(7, false);
    });

    it("should close with the products not counted at zero when the person chooses it", async () => {
        await render();
        await fixture.componentInstance.review();
        fixture.detectChanges();

        el.querySelectorAll<HTMLInputElement>("input[type=radio]")[1].click();
        fixture.detectChanges();
        el.querySelector<HTMLButtonElement>(".review-actions .btn-primary")!.click();
        await fixture.whenStable();

        expect(close).toHaveBeenCalledWith(7, true);
        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 7], { replaceUrl: true });
    });

    it("should not offer to finish before anything is counted", async () => {
        await render(detail(lines, { countedCount: 0, uncountedCount: 34 }));

        expect(el.querySelector<HTMLButtonElement>(".bar .btn")!.disabled).toBe(true);
    });

    it("should warn before leaving with entries not sent, and say they stay on the device", async () => {
        await render();
        online.set(false);
        saveItems.mockImplementation(() => {
            throw Object.assign(new Error("offline"), { status: 0 });
        });
        type(inputs()[0], "5");

        const leaving = fixture.componentInstance.canLeave();
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();

        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(
            text(el.querySelector("dialog#leave, dialog[aria-labelledby=leave-title]")),
        ).toContain("1 saisie pas encore envoyée");

        fixture.componentInstance.answerLeave(true);
        expect(await leaving).toBe(true);
    });

    it("should let the person leave when everything is saved", async () => {
        await render();

        expect(await fixture.componentInstance.canLeave()).toBe(true);
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
    });
});

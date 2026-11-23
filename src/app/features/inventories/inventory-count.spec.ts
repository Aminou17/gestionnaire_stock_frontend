import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { dbDelete, dbGet } from "../../core/offline/local-db";
import { NetworkService } from "../../core/offline/network.service";
import { Inventory, InventoryDetail, InventoryItem } from "../../core/stock/inventory.model";
import { AuthService } from "../../core/auth/auth.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { Product } from "../../core/stock/product.model";
import { ProductService } from "../../core/stock/product.service";
import { ToastService } from "../../shared/toast/toast.service";
import { InventoryCount } from "./inventory-count";

const inventory = (changes: Partial<Inventory> = {}): Inventory => ({
    id: 7,
    name: null,
    status: "in_progress",
    statusLabel: "En cours",
    startedAt: "2026-11-23T10:00:00Z",
    countedAt: null,
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Awa", avatar: null },
    countedBy: null,
    appliedBy: null,
    cancelledBy: null,
    itemsCount: 2,
    differenceCount: null,
    differenceValue: null,
    maxStock: 1000,
    ...changes,
});

// le serveur envoie le stock théorique à l'admin : l'écran ne doit jamais l'afficher
const item = (id: number, name: string, actual: number, countedAt: string): InventoryItem => ({
    id,
    productId: id,
    productName: name,
    image: null,
    actualStock: actual,
    countedAt,
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
    reason: null,
});

const detail = (items: InventoryItem[], changes: Partial<Inventory> = {}): InventoryDetail => ({
    ...inventory({ itemsCount: items.length, ...changes }),
    items,
    pagination: { page: 1, limit: 500, total: items.length, totalPages: 1 },
});

const product = (id: number, name: string, barcode: string | null = null): Product =>
    ({
        id,
        name,
        category_name: "Céréales",
        barcode,
        image: null,
        theoretical_stock: 41,
        is_active: true,
    }) as Product;

describe("InventoryCount", () => {
    let fixture: ComponentFixture<InventoryCount>;
    let el: HTMLElement;
    let router: Router;
    let getInventory: ReturnType<typeof vi.fn>;
    let saveItems: ReturnType<typeof vi.fn>;
    let close: ReturnType<typeof vi.fn>;
    let getProducts: ReturnType<typeof vi.fn>;
    const online = signal(true);

    const riz = product(1, "Riz parfumé 5 kg", "6001");
    const farine = product(2, "Farine de blé 1 kg", "6002");

    // deux produits déjà comptés : le dernier compté arrive en haut
    const counted = detail([
        item(1, "Riz parfumé 5 kg", 12, "2026-11-23T10:05:00Z"),
        item(2, "Farine de blé 1 kg", 7, "2026-11-23T10:10:00Z"),
    ]);

    async function render(first: InventoryDetail = counted) {
        await dbDelete("kv", "inventory-draft-7");
        online.set(true);
        getInventory = vi.fn(() => of(first));
        saveItems = vi.fn(() => of({ saved: 1, inventory: inventory({ itemsCount: 3 }) }));
        close = vi.fn(() => of({ inventory: inventory({ status: "counted" }) }));
        // la recherche et le scan trouvent le produit dont le nom ou le code correspond
        getProducts = vi.fn(({ search }: { search: string }) => {
            const data = [riz, farine, product(3, "Sucre 1 kg", "6003")].filter(
                (p) => p.barcode === search || p.name.toLowerCase().includes(search.toLowerCase()),
            );
            return of({ data, total: data.length, counters: {} });
        });

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
                        snapshot: { queryParamMap: convertToParamMap({}) },
                        paramMap: of(convertToParamMap({ id: "7" })),
                    },
                },
                { provide: NetworkService, useValue: { online } },
                {
                    provide: InventoryService,
                    useValue: { getInventory, saveItems, removeItem: vi.fn(), close },
                },
                { provide: ProductService, useValue: { getProducts } },
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(true), isOwner: signal(false), user: signal({}) },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, "navigate").mockResolvedValue(true);
        fixture = TestBed.createComponent(InventoryCount);
        el = fixture.nativeElement;
        await fixture.whenStable();
        fixture.detectChanges();
    }

    const text = (node: Element | null = el) => node!.textContent!.replace(/\s+/g, " ");
    const inputs = () => [...el.querySelectorAll<HTMLInputElement>("input.count")];
    const names = () => [...el.querySelectorAll(".lines .name")].map((n) => text(n).trim());

    // laisse finir les recherches et les scans, qui s'enchaînent en promesses
    const settle = async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await fixture.whenStable();
        fixture.detectChanges();
    };

    const type = (field: HTMLInputElement, value: string) => {
        field.value = value;
        field.dispatchEvent(new Event("input"));
        fixture.detectChanges();
    };

    const search = async (value: string) => {
        type(el.querySelector<HTMLInputElement>(".search input")!, value);
        await settle();
    };

    it("should list the chosen products, the last counted first, without any gauge or tab", async () => {
        await render();

        expect(text(el.querySelector(".list-title"))).toBe("Produits comptés (2)");
        expect(names()).toEqual(["Farine de blé 1 kg", "Riz parfumé 5 kg"]);
        expect(inputs().map((field) => field.value)).toEqual(["7", "12"]);
        expect(el.querySelector(".tab, .tabs, .gauge, [role=progressbar]")).toBeNull();
        expect(text()).not.toMatch(/non compt|sur \d+ compt/i);
        expect(text()).not.toContain("À compter");
        // aucun chargement de toute la boutique
        expect(getProducts).not.toHaveBeenCalled();
    });

    it("should show a simple sentence and nothing else when no product is chosen", async () => {
        await render(detail([]));

        expect(text(el.querySelector(".empty"))).toContain(
            "Cherchez ou scannez les produits à compter",
        );
        expect(el.querySelector(".lines")).toBeNull();
        expect(el.querySelector(".bar")).toBeNull();
    });

    it("should never show the theoretical stock while counting", async () => {
        await render();
        await search("riz");

        expect(text()).not.toContain("41");
        expect(text()).not.toContain("600");
        expect(text()).not.toContain("en stock");
    });

    it("should show the results under the bar and add the touched product with its field ready", async () => {
        await render(detail([]));

        await search("farine");
        expect(el.querySelectorAll(".result").length).toBe(1);

        el.querySelector<HTMLButtonElement>(".result")!.click();
        await settle();

        expect(names()).toEqual(["Farine de blé 1 kg"]);
        // rien n'est envoyé tant que la quantité n'est pas saisie
        expect(fixture.componentInstance.sync.pendingCount()).toBe(0);
        expect(inputs()[0].value).toBe("");
        expect(document.activeElement).toBe(inputs()[0]);
        expect(el.querySelector(".results")).toBeNull();
        expect(el.querySelector<HTMLButtonElement>(".bar .btn")!.disabled).toBe(true);

        type(inputs()[0], "5");
        expect(fixture.componentInstance.sync.pending()).toEqual({ 2: 5 });
        expect(text(el.querySelector(".list-title"))).toBe("Produits comptés (1)");
        expect(el.querySelector<HTMLButtonElement>(".bar .btn")!.disabled).toBe(false);
    });

    it("should say when a product is already in the list instead of adding it twice", async () => {
        await render();
        await search("riz");

        expect(text(el.querySelector(".result"))).toContain("Dans la liste");
        el.querySelector<HTMLButtonElement>(".result")!.click();
        await settle();

        expect(names().length).toBe(2);
    });

    it("should add the product of a scan with 1, and add 1 more for each new scan", async () => {
        await render(detail([]));

        fixture.componentInstance.onScan("6001");
        await settle();

        expect(names()).toEqual(["Riz parfumé 5 kg"]);
        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 1 });

        fixture.componentInstance.onScan("6001");
        fixture.componentInstance.onScan("6001");
        await settle();

        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 3 });
        expect(names().length).toBe(1);
        expect(inputs()[0].value).toBe("3");
    });

    it("should bring a product scanned again to the top of the list", async () => {
        await render();
        expect(names()[0]).toBe("Farine de blé 1 kg");

        fixture.componentInstance.onScan("6001");
        await settle();

        expect(names()).toEqual(["Riz parfumé 5 kg", "Farine de blé 1 kg"]);
        expect(fixture.componentInstance.sync.pending()).toEqual({ 1: 13 });
    });

    it("should tell when a scanned code matches no product", async () => {
        await render(detail([]));
        const toast = TestBed.inject(ToastService);

        fixture.componentInstance.onScan("0000");
        await settle();

        expect(toast.message()).toContain("Aucun produit ne porte ce code");
        expect(names().length).toBe(0);
    });

    it("should add a product with Enter when its barcode is typed", async () => {
        await render(detail([]));
        await search("6003");

        el.querySelector<HTMLInputElement>(".search input")!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter" }),
        );
        await settle();

        expect(names()).toEqual(["Sucre 1 kg"]);
    });

    it("should remove a product from the count, and tell the server when it knew it", async () => {
        await render();

        el.querySelectorAll<HTMLButtonElement>(".remove")[0].click();
        fixture.detectChanges();

        expect(names()).toEqual(["Riz parfumé 5 kg"]);
        // le serveur connaît ce produit : sa ligne est retirée (null = suppression)
        expect(fixture.componentInstance.sync.pending()).toEqual({ 2: null });
    });

    it("should forget a product added but never sent when it is removed", async () => {
        await render(detail([]));
        await search("riz");
        el.querySelector<HTMLButtonElement>(".result")!.click();
        await settle();

        el.querySelector<HTMLButtonElement>(".remove")!.click();
        fixture.detectChanges();

        expect(names().length).toBe(0);
        expect(fixture.componentInstance.sync.pendingCount()).toBe(0);
    });

    it("should keep only the digits, count the entry right away and mark the line", async () => {
        await render();

        type(inputs()[0], "1a2");

        expect(inputs()[0].value).toBe("12");
        expect(fixture.componentInstance.sync.pending()).toEqual({ 2: 12 });
        expect(el.querySelector(".line.counted")).not.toBeNull();
    });

    it("should step with the buttons, start from 0 and stop at 0", async () => {
        await render(detail([]));
        fixture.componentInstance.onScan("6001");
        await settle();
        type(inputs()[0], "");

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

    it("should not offer a separate 0 button: the quantity is simply typed", async () => {
        await render();

        expect(el.querySelector(".zero")).toBeNull();
    });

    it("should never go over the maximum stock of the server", async () => {
        await render();

        type(inputs()[0], "999999");

        expect(fixture.componentInstance.sync.pending()).toEqual({ 2: 1000 });
    });

    it("should move to the next product with Enter", async () => {
        await render();

        inputs()[0].focus();
        inputs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(document.activeElement).toBe(inputs()[1]);
    });

    it("should leave the counting to the page of the inventory when it is already closed", async () => {
        await render(detail(counted.items, { status: "counted" }));

        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 7], { replaceUrl: true });
    });

    it("should close straight away on the button, with no confirmation question", async () => {
        await render();

        await fixture.componentInstance.finish();
        await fixture.whenStable();

        expect(el.querySelector("dialog[aria-labelledby=finish-title]")).toBeNull();
        expect(close).toHaveBeenCalledWith(7);
        expect(router.navigate).toHaveBeenCalledWith(["/inventories", 7], { replaceUrl: true });
    });

    it("should hide the bottom bar until a product is in the list", async () => {
        await render(detail([]));

        expect(el.querySelector(".bar")).toBeNull();
    });

    it("should tell the admin the next step on the button", async () => {
        await render();

        expect(text(el.querySelector(".bar .btn")).trim()).toBe("Terminer et voir les écarts");
    });

    it("should keep a draft on the device when offline, and warn before leaving", async () => {
        await render();
        online.set(false);
        saveItems.mockImplementation(() => {
            throw Object.assign(new Error("offline"), { status: 0 });
        });
        type(inputs()[0], "5");

        expect(await dbGet("kv", "inventory-draft-7")).toEqual({ 2: 5 });

        const leaving = fixture.componentInstance.canLeave();
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();

        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(text(el.querySelector("dialog[aria-labelledby=leave-title]"))).toContain(
            "1 saisie pas encore envoyée",
        );

        fixture.componentInstance.answerLeave(true);
        expect(await leaving).toBe(true);
    });

    it("should let the person leave when everything is saved", async () => {
        await render();

        expect(await fixture.componentInstance.canLeave()).toBe(true);
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
    });
});

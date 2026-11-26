import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { Inventory, InventoryList } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { Inventories } from "./inventories";

const inventory = (changes: Partial<Inventory> = {}): Inventory => ({
    id: 10,
    name: null,
    status: "counted",
    statusLabel: "À valider",
    startedAt: "2026-11-12T15:00:00Z",
    countedAt: "2026-11-12T16:00:00Z",
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Adam Ouédraogo", avatar: null },
    countedBy: null,
    appliedBy: null,
    cancelledBy: null,
    itemsCount: 30,
    differenceCount: 12,
    differenceValue: -45000,
    maxStock: 1000000,
    ...changes,
});

const list = (data: Inventory[], total = data.length): InventoryList => ({
    data,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
});

describe("Inventories", () => {
    let fixture: ComponentFixture<Inventories>;
    let el: HTMLElement;
    let getInventories: ReturnType<typeof vi.fn>;
    let exportList: ReturnType<typeof vi.fn>;

    // Deux demandes : ce qu'il reste à faire (en cours, à valider) puis l'historique (terminés)
    async function render(history: Inventory[], isAdmin = true, todo: Inventory[] = []) {
        getInventories = vi.fn((filters) =>
            filters.statuses.includes("applied") ? of(list(history)) : of(list(todo)),
        );
        exportList = vi.fn(() => of(new Blob(["x"])));

        await TestBed.configureTestingModule({
            imports: [Inventories],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { getInventories, exportList } },
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

        fixture = TestBed.createComponent(Inventories);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = (node: Element | null = el) => node!.textContent!.replace(/\s+/g, " ");
    const done = (changes: Partial<Inventory> = {}) =>
        inventory({ status: "applied", statusLabel: "Terminé", ...changes });

    it("should show a finished inventory with its date and hour, and the loss in red for the admin", async () => {
        await render([done()]);

        const row = el.querySelector(".history-block .row, #history-title ~ .rows .row")!;
        expect(text(row)).toContain("12 nov. à");
        expect(text(row)).toContain("12 écarts");
        expect(text(row)).toContain("45 000 F");
        expect(row.querySelector(".title.loss")).not.toBeNull();
        expect(row.getAttribute("href")).toBe("/inventories/10");
    });

    it("should not write the status on a finished inventory", async () => {
        await render([done()]);

        expect(el.querySelector("app-inventory-status")).toBeNull();
        expect(text(el)).not.toContain("Terminé");
    });

    it("should put what is left to do first, with its status", async () => {
        await render([done({ id: 11 })], true, [inventory({ id: 12 })]);

        const titles = [...el.querySelectorAll(".block-title")].map((node) => text(node).trim());
        expect(titles).toEqual(["À faire", "Historique"]);
        expect(text(el.querySelector("#todo-title ~ .rows"))).toContain("À valider");
    });

    it("should open a counting in progress directly on the counting screen", async () => {
        await render([], true, [
            inventory({ id: 20, status: "in_progress", statusLabel: "En cours", itemsCount: 3 }),
        ]);

        const row = el.querySelector(".row")!;
        expect(row.getAttribute("href")).toBe("/inventories/20/count");
        expect(text(row)).toContain("3 produits comptés");
    });

    it("should never ask for the cancelled ones", async () => {
        await render([]);

        const asked = getInventories.mock.calls.flatMap((call) => call[0].statuses);
        expect(asked).not.toContain("cancelled");
    });

    it("should show the manager only how many products were counted, never money", async () => {
        await render([done()], false);

        expect(text(el.querySelector(".row"))).toContain("30 produits comptés");
        expect(text(el)).not.toContain("45 000");
        expect(text(el)).not.toContain("écart");
    });

    it("should keep search and status chips out of the page", async () => {
        await render([done()]);

        expect(el.querySelector("input[type=search]")).toBeNull();
        expect(el.querySelector(".chip")).toBeNull();
    });

    it("should not clutter the list with an export menu", async () => {
        await render([done()]);

        expect(el.querySelector("app-action-menu")).toBeNull();
    });

    it("should hide a counting in progress that has no product yet", async () => {
        await render([], true, [
            inventory({ id: 30, status: "in_progress", statusLabel: "En cours", itemsCount: 0 }),
        ]);

        expect(el.querySelector(".row")).toBeNull();
        expect(text(el)).toContain("Aucun inventaire pour le moment");
    });

    it("should write the result first and the date under it", async () => {
        await render([done()]);

        const row = el.querySelector(".row")!;
        expect(text(row.querySelector(".title"))).toContain("12 écarts");
        expect(text(row.querySelector(".result"))).toContain("12 nov. à");
    });

    it("should invite to count when there is nothing yet", async () => {
        await render([]);

        expect(text(el)).toContain("Aucun inventaire pour le moment");
        expect(el.querySelector("a[href='/inventories/new']")).not.toBeNull();
    });

    it("should offer a retry when the list cannot be loaded", async () => {
        getInventories = vi.fn(() => throwError(() => new Error("down")));
        await TestBed.configureTestingModule({
            imports: [Inventories],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { getInventories, exportList: vi.fn() } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Test" }),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Inventories);
        el = fixture.nativeElement;
        await fixture.whenStable();

        expect(text(el)).toContain("Impossible de charger les inventaires.");
    });
});

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
    scope: { type: "all", categoryId: null, categoryName: null },
    startedAt: "2026-11-12T15:00:00Z",
    countedAt: "2026-11-12T16:00:00Z",
    appliedAt: null,
    cancelledAt: null,
    createdBy: { id: 1, name: "Awa Bazin", avatar: null },
    countedBy: null,
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

const list = (data: Inventory[], total = data.length): InventoryList => ({
    data,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
});

describe("Inventories", () => {
    let fixture: ComponentFixture<Inventories>;
    let el: HTMLElement;
    let getInventories: ReturnType<typeof vi.fn>;
    let exportList: ReturnType<typeof vi.fn>;

    // la première requête est la liste, la seconde le comptage ouvert
    async function render(rows: Inventory[], isAdmin = true, open: Inventory[] = []) {
        getInventories = vi.fn((filters) =>
            filters.limit === 1 ? of(list(open)) : of(list(rows)),
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

    it("should name an inventory by its date and tell the gap and the loss to the admin", async () => {
        await render([inventory()]);

        expect(text(el.querySelector(".row"))).toContain("Inventaire du 12 nov.");
        expect(text(el.querySelector(".row"))).toContain("12 écarts, perte de 45 000 F");
        expect(el.querySelector(".row")?.getAttribute("href")).toBe("/inventories/10");
    });

    it("should show the manager only how many products were counted, never money", async () => {
        await render([inventory({ differenceCount: 12, differenceValue: null })], false);

        expect(text(el.querySelector(".row"))).toContain("30 produits comptés");
        expect(text(el)).not.toContain(" F");
        expect(el.querySelector("app-export-menu")).toBeNull();
    });

    it("should show the status of each inventory in its own colour", async () => {
        await render([
            inventory({ id: 4, status: "applied", statusLabel: "Terminé" }),
            inventory({ id: 3, status: "cancelled", statusLabel: "Annulé" }),
            inventory({ id: 2 }),
        ]);

        expect(el.querySelector(".badge-success")?.textContent).toContain("Terminé");
        expect(el.querySelector(".badge-neutral")?.textContent).toContain("Annulé");
        expect(el.querySelector(".badge-warning")?.textContent).toContain("À valider");
    });

    it("should put the counting in progress at the top and take it out of the list", async () => {
        const open = inventory({
            id: 12,
            name: "Fin de mois",
            status: "in_progress",
            statusLabel: "En cours",
            countedCount: 12,
        });
        await render([open, inventory()], true, [open]);

        const resume = el.querySelector(".resume");
        expect(text(resume)).toContain("Fin de mois");
        expect(text(resume)).toContain("12 sur 34 produits comptés");
        expect(resume?.querySelector("a")?.getAttribute("href")).toBe("/inventories/12/count");
        expect(text(resume)).toContain("Reprendre le comptage");
        expect(el.querySelectorAll(".row").length).toBe(1);
    });

    it("should filter by status with the chips and go back to the first page", async () => {
        await render([inventory()]);

        const chips = [...el.querySelectorAll<HTMLButtonElement>(".chips .chip")];
        expect(chips.map((chip) => chip.textContent!.trim())).toEqual([
            "Tous",
            "En cours",
            "À valider",
            "Terminés",
        ]);

        chips[2].click();
        await fixture.whenStable();

        expect(getInventories).toHaveBeenLastCalledWith(
            expect.objectContaining({ statuses: ["counted"], page: 1 }),
        );
        expect(chips[2].getAttribute("aria-pressed")).toBe("true");
    });

    it("should show an empty state with the main action when there is nothing", async () => {
        await render([]);

        expect(text(el)).toContain("Aucun inventaire pour le moment");
        expect(el.querySelector("app-empty-state a")?.getAttribute("href")).toBe(
            "/inventories/new",
        );
    });

    it("should offer to retry when the list cannot be loaded", async () => {
        getInventories = vi.fn(() => throwError(() => new Error("500")));
        await TestBed.configureTestingModule({
            imports: [Inventories],
            providers: [
                provideRouter([]),
                { provide: InventoryService, useValue: { getInventories } },
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(true), isOwner: signal(false), user: signal({}) },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(Inventories);
        el = fixture.nativeElement;
        await fixture.whenStable();

        expect(text(el)).toContain("Impossible de charger les inventaires");
        expect(el.querySelector("app-load-error button")).not.toBeNull();
    });

    it("should export in the chosen format and show a closable error when it fails", async () => {
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        await render([inventory()]);

        fixture.componentInstance.exportFile("csv");
        expect(exportList).toHaveBeenCalledWith("csv");
        expect(fixture.componentInstance.exporting()).toBe(false);

        exportList.mockReturnValue(throwError(() => new Error("500")));
        fixture.componentInstance.exportFile("pdf");
        fixture.detectChanges();

        expect(el.querySelector(".alert")?.textContent).toContain("Impossible d'exporter");
        el.querySelector<HTMLButtonElement>(".alert-close")!.click();
        fixture.detectChanges();
        expect(el.querySelector(".alert")).toBeNull();
    });
});

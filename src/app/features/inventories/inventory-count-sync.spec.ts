import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { of, throwError } from "rxjs";

import { dbDelete, dbGet, dbSet } from "../../core/offline/local-db";
import { NetworkService } from "../../core/offline/network.service";
import { InventoryService } from "../../core/stock/inventory.service";
import { CountSync } from "./inventory-count-sync";

const inventory = { id: 7, itemsCount: 1 };

describe("CountSync", () => {
    let sync: CountSync;
    const online = signal(true);
    let saveItems: ReturnType<typeof vi.fn>;
    let removeItem: ReturnType<typeof vi.fn>;

    const setup = () => {
        saveItems = vi.fn(() => of({ saved: 1, inventory }));
        removeItem = vi.fn(() => of({ inventory }));

        TestBed.configureTestingModule({
            providers: [
                CountSync,
                { provide: NetworkService, useValue: { online } },
                { provide: InventoryService, useValue: { saveItems, removeItem } },
            ],
        });
        sync = TestBed.inject(CountSync);
    };

    beforeEach(async () => {
        vi.useFakeTimers();
        online.set(true);
        await dbDelete("kv", "inventory-draft-7");
        setup();
        await sync.start(7);
    });

    afterEach(() => vi.useRealTimers());

    it("should group the entries typed in a row in one packet, 800 ms after the last one", async () => {
        sync.set(1, 5);
        sync.set(2, 8);
        sync.set(1, 6);

        await vi.advanceTimersByTimeAsync(700);
        expect(saveItems).not.toHaveBeenCalled();
        expect(sync.state()).toBe("saving");

        await vi.advanceTimersByTimeAsync(200);
        expect(saveItems).toHaveBeenCalledTimes(1);
        expect(saveItems).toHaveBeenCalledWith(7, [
            { productId: 1, actualStock: 6 },
            { productId: 2, actualStock: 8 },
        ]);
        expect(sync.pendingCount()).toBe(0);
        expect(sync.state()).toBe("saved");
    });

    it("should keep the entries on the device and say so when the network is away", async () => {
        online.set(false);
        sync.set(1, 5);
        expect(sync.state()).toBe("offline");

        saveItems.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 0, statusText: "Unknown Error" })),
        );
        await vi.advanceTimersByTimeAsync(900);

        expect(sync.state()).toBe("offline");
        expect(sync.pending()).toEqual({ 1: 5 });
        expect(await dbGet("kv", "inventory-draft-7")).toEqual({ 1: 5 });
    });

    it("should send the draft again when the page is reopened", async () => {
        await dbSet("kv", "inventory-draft-7", { 4: 12, 5: null });

        await sync.start(7);

        expect(saveItems).toHaveBeenCalledWith(7, [{ productId: 4, actualStock: 12 }]);
        expect(removeItem).toHaveBeenCalledWith(7, 5);
        expect(sync.pendingCount()).toBe(0);
        expect(await dbGet("kv", "inventory-draft-7")).toBeUndefined();
    });

    it("should remove a product from the count with a delete, not with a zero", async () => {
        sync.set(9, null);
        await vi.advanceTimersByTimeAsync(900);

        expect(removeItem).toHaveBeenCalledWith(7, 9);
        expect(saveItems).not.toHaveBeenCalled();
    });

    it("should not fail when the product was already out of the count", async () => {
        removeItem.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));

        sync.set(9, null);
        await vi.advanceTimersByTimeAsync(900);

        expect(sync.state()).toBe("saved");
        expect(sync.pendingCount()).toBe(0);
    });

    it("should keep a value changed while the packet was on its way", async () => {
        let release: (value: unknown) => void = () => {};
        saveItems.mockReturnValueOnce(new Promise((resolve) => (release = resolve)) as never);

        sync.set(1, 5);
        const flushing = sync.flush();
        sync.set(1, 6);
        release({ saved: 1, inventory });
        await vi.advanceTimersByTimeAsync(0);
        await flushing;

        expect(sync.pending()).toEqual({ 1: 6 });
    });

    it("should stop and show the message when the server refuses", async () => {
        saveItems.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 409,
                        error: { message: "Cet inventaire n'accepte plus de comptage." },
                    }),
            ),
        );

        sync.set(1, 5);
        await vi.advanceTimersByTimeAsync(900);

        expect(sync.state()).toBe("error");
        expect(sync.error()).toBe("Cet inventaire n'accepte plus de comptage.");
        expect(sync.pending()).toEqual({ 1: 5 });
    });

    it("should forget an entry that has nothing to send", () => {
        sync.set(1, 5);
        sync.forget(1);

        expect(sync.pendingCount()).toBe(0);
        expect(sync.state()).toBe("saved");
    });

    it("should tell the page what the server received", async () => {
        const onSaved = vi.fn();
        sync.onSaved = onSaved;

        sync.set(1, 5);
        await vi.advanceTimersByTimeAsync(900);

        expect(onSaved).toHaveBeenCalledWith(inventory, { 1: 5 });
    });
});

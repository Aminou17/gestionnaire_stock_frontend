import { TestBed } from "@angular/core/testing";

import { ToastService } from "./toast.service";

describe("ToastService", () => {
    afterEach(() => vi.useRealTimers());

    it("should show a message, replace it, then hide it after a while", () => {
        vi.useFakeTimers();
        const toast = TestBed.inject(ToastService);

        toast.show("Produit ajouté");
        toast.show("Produit enregistré");
        expect(toast.message()).toBe("Produit enregistré");

        vi.advanceTimersByTime(3000);
        expect(toast.message()).toBeNull();
    });
});

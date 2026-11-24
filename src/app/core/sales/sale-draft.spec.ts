import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AuthService } from "../auth/auth.service";
import { Product } from "../stock/product.model";
import { SaleDraft } from "./sale-draft";

describe("SaleDraft", () => {
    const user = signal<{ id: number } | null>({ id: 1 });

    function create() {
        user.set({ id: 1 });
        TestBed.configureTestingModule({
            providers: [{ provide: AuthService, useValue: { user } }],
        });

        return TestBed.inject(SaleDraft);
    }

    const line = { product: { id: 5, name: "Riz" } as Product, quantity: 2, unitPrice: 1500 };

    it("should keep the products picked until they are removed", () => {
        const draft = create();

        draft.cart.set([line]);

        expect(TestBed.inject(SaleDraft).cart()).toEqual([line]);
    });

    it("should empty the cart when the person signs out", async () => {
        const draft = create();
        draft.cart.set([line]);

        user.set(null);
        TestBed.tick();

        expect(draft.cart()).toEqual([]);
    });
});

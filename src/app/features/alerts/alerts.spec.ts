import { HttpErrorResponse } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";

import { Alerts } from "./alerts";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlert } from "../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const tissu: LowStockAlert = {
    id: 1,
    name: "Bazin riche bleu",
    theoretical_stock: 0,
    min_stock: 5,
};
const pagne: LowStockAlert = { id: 2, name: "Pagne wax", theoretical_stock: 3, min_stock: 5 };

describe("Alerts", () => {
    let fixture: ComponentFixture<Alerts>;
    let el: HTMLElement;
    let reload: ReturnType<typeof vi.fn>;

    async function render(state: { value?: LowStockAlert[]; error?: HttpErrorResponse }) {
        reload = vi.fn();

        await TestBed.configureTestingModule({
            imports: [Alerts],
            providers: [
                provideRouter([]),
                {
                    provide: LowStockAlertService,
                    useValue: {
                        count: signal(state.value?.length ?? 0),
                        alerts: {
                            isLoading: () => false,
                            hasValue: () => !!state.value,
                            value: () => state.value,
                            error: () => state.error,
                            reload,
                        },
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        user: signal({
                            id: 1,
                            name: "Awa Bazin",
                            email: "awa@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Propriétaire"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Alerts);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should list the products with their status and counters", async () => {
        await render({ value: [tissu, pagne] });

        expect(text()).toContain("Tous 2");
        expect(text()).toContain("En rupture 1");
        expect(text()).toContain("Stock faible 1");
        expect(text()).toContain("Bazin riche bleu");
        expect(text()).toContain("Pagne wax");
    });

    it("should filter on the out of stock products", async () => {
        await render({ value: [tissu, pagne] });
        el.querySelectorAll<HTMLButtonElement>(".tab")[1].click();
        await fixture.whenStable();

        expect(text()).toContain("Bazin riche bleu");
        expect(text()).not.toContain("Pagne wax");
    });

    it("should filter on the low stock products", async () => {
        await render({ value: [tissu, pagne] });
        el.querySelectorAll<HTMLButtonElement>(".tab")[2].click();
        await fixture.whenStable();

        expect(text()).toContain("Pagne wax");
        expect(text()).not.toContain("Bazin riche bleu");
    });

    it("should say when a category is empty", async () => {
        await render({ value: [pagne] });
        el.querySelectorAll<HTMLButtonElement>(".tab")[1].click();
        await fixture.whenStable();

        expect(text()).toContain("Aucun produit dans cette catégorie.");
    });

    it("should link each product to a restock entry", async () => {
        await render({ value: [pagne] });

        const link = el.querySelector<HTMLAnchorElement>(".restock")!;
        expect(link.getAttribute("href")).toBe("/stock-entries?productId=2");
    });

    it("should say all is fine when nothing is under its threshold", async () => {
        await render({ value: [] });

        expect(text()).toContain("Tout est en ordre");
    });

    it("should send to the settings when the general threshold is missing", async () => {
        await render({
            error: new HttpErrorResponse({
                status: 409,
                error: { message: "Veuillez configurer le seuil général de stock." },
            }),
        });

        expect(text()).toContain("Veuillez configurer le seuil général");
        expect(el.querySelector("a[href='/settings/stock']")).not.toBeNull();
        expect(el.querySelector(".empty button")).toBeNull();
        expect(el.querySelector(".tabs")).toBeNull();
    });

    it("should offer to retry on another error", async () => {
        await render({ error: new HttpErrorResponse({ status: 500 }) });
        el.querySelector<HTMLButtonElement>(".empty button")!.click();

        expect(text()).toContain("Impossible de charger les alertes.");
        expect(reload).toHaveBeenCalled();
    });
});

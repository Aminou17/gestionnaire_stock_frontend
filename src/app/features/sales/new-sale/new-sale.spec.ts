import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { NewSale } from "./new-sale";
import { AuthService } from "../../../core/auth/auth.service";
import { CashSessionService, TodayCash } from "../../../core/cash/cash-session.service";
import { SaleService } from "../../../core/sales/sale.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";

const product = (id: number, name: string, overrides: Partial<Product> = {}): Product => ({
    id,
    name,
    category_name: "Bazin",
    sale_price: 1500,
    pricing_mode: "FIXED",
    max_discount: 0,
    theoretical_stock: 10,
    is_active: true,
    min_stock: null,
    effective_min_stock: 5,
    stock_status: "OK",
    ...overrides,
});

const riz = product(3, "Riz");
const bazin = product(4, "Bazin riche", {
    pricing_mode: "NEGOTIABLE",
    sale_price: 10000,
    max_discount: 1500,
});
const savon = product(5, "Savon", { theoretical_stock: 0, stock_status: "OUT_OF_STOCK" });

let preselected: Product = bazin;

describe("NewSale", () => {
    let fixture: ComponentFixture<NewSale>;
    let el: HTMLElement;
    let createSale: ReturnType<typeof vi.fn>;
    let navigate: ReturnType<typeof vi.fn>;

    async function render({
        cash = { status: "OPEN", balance: 1000 } as TodayCash | null,
        isAdmin = false,
        productId = null as string | null,
        createFails = false,
    } = {}) {
        createSale = vi.fn(() =>
            createFails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Stock insuffisant pour le produit 3." },
                          }),
                  )
                : of({ id: 9 }),
        );

        await TestBed.configureTestingModule({
            imports: [NewSale],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap(productId ? { productId } : {}),
                        },
                    },
                },
                { provide: SaleService, useValue: { createSale } },
                { provide: CashSessionService, useValue: { getTodayCash: () => of(cash) } },
                {
                    provide: ProductService,
                    useValue: {
                        getProducts: () =>
                            of({ data: [riz, bazin, savon], total: 3, counters: {} }),
                        getProduct: () => of(preselected),
                    },
                },
                {
                    provide: LowStockAlertService,
                    useValue: { count: signal(0), alerts: { reload: vi.fn() } },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        user: signal({
                            id: 6,
                            name: "Awa K.",
                            email: "a@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                    },
                },
            ],
        }).compileComponents();

        navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true) as never;
        fixture = TestBed.createComponent(NewSale);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");
    const results = () => [...el.querySelectorAll<HTMLButtonElement>(".result")];
    const submitBtn = () => el.querySelector<HTMLButtonElement>(".cart-footer .btn")!;

    async function add(index: number) {
        results()[index].click();
        await fixture.whenStable();
    }

    it("should add a product to the cart and compute the total", async () => {
        await render();
        expect(submitBtn().disabled).toBe(true);

        await add(0);
        el.querySelector<HTMLButtonElement>("[aria-label='Augmenter la quantité']")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".total")!.textContent!.replace(/\s/g, " ")).toContain("3 000 F");
        expect(results()[0].disabled).toBe(true);
        expect(submitBtn().disabled).toBe(false);
    });

    it("should not let an out of stock product be added", async () => {
        await render();
        expect(results()[2].disabled).toBe(true);
        expect(results()[2].textContent).toContain("Rupture");
    });

    it("should send the price only for a negotiable product", async () => {
        await render();
        await add(0);
        await add(1);

        const price = el.querySelector<HTMLInputElement>(".price-field input")!;
        price.value = "9000";
        price.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith(
            [
                { productId: 3, quantity: 1 },
                { productId: 4, quantity: 1, unitPrice: 9000 },
            ],
            { paymentMethod: "CASH", amountReceived: 10500 },
        );
        expect(navigate).toHaveBeenCalledWith(["/sales", 9], { state: { created: true } });
    });

    it("should block a negotiated price below the minimum", async () => {
        await render();
        await add(1);

        const price = el.querySelector<HTMLInputElement>(".price-field input")!;
        price.value = "8000";
        price.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        expect(text()).toContain("Prix hors des limites autorisées.");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should block a quantity above the stock", async () => {
        await render();
        await add(0);

        const qty = el.querySelector<HTMLInputElement>(".stepper input")!;
        qty.value = "11";
        qty.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        expect(text()).toContain("Stock insuffisant : 10 disponibles.");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should tell the manager to ask the owner when the cash register is closed", async () => {
        await render({ cash: null });
        await add(0);

        expect(text()).toContain("demandez au propriétaire de l'ouvrir");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should prefill the cart from the product page", async () => {
        await render({ productId: "4" });
        expect(el.querySelector(".lines")?.textContent).toContain("Bazin riche");
    });

    it("should show the backend message when the sale is refused", async () => {
        await render({ createFails: true });
        await add(0);
        submitBtn().click();
        await fixture.whenStable();

        expect(text()).toContain("Stock insuffisant pour le produit 3.");
        expect(navigate).not.toHaveBeenCalled();
    });

    it("should explain why an out of stock product from the product page is not added", async () => {
        preselected = savon;
        await render({ productId: "5" });
        preselected = bazin;

        expect(el.querySelector(".lines")).toBeNull();
        expect(text()).toContain("« Savon » est en rupture de stock.");
    });

    it("should rewrite a decimal or empty quantity in the field", async () => {
        await render();
        await add(0);

        const qty = el.querySelector<HTMLInputElement>(".stepper input")!;
        qty.value = "2.4";
        qty.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(qty.value).toBe("2");

        qty.value = "";
        qty.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(qty.value).toBe("1");
    });

    it("should send the sale only once on a double click", async () => {
        await render();
        await add(0);
        submitBtn().click();
        submitBtn().click();

        expect(createSale).toHaveBeenCalledTimes(1);
    });

    it("should compute the change from the cash received", async () => {
        await render();
        await add(0);

        const received = el.querySelector<HTMLInputElement>(".payment input")!;
        received.value = "5000";
        received.dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(el.querySelector(".change")!.textContent!.replace(/\s/g, " ")).toContain("3 500 F");
        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith([{ productId: 3, quantity: 1 }], {
            paymentMethod: "CASH",
            amountReceived: 5000,
        });
    });

    it("should block the sale when the cash received is below the total", async () => {
        await render();
        await add(0);

        const received = el.querySelector<HTMLInputElement>(".payment input")!;
        received.value = "1000";
        received.dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(text()).toContain("Il manque 500 F.");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should fill the received amount from a quick amount", async () => {
        await render();
        await add(0);

        const chips = [...el.querySelectorAll<HTMLButtonElement>(".chip")];
        expect(chips[0].textContent).toContain("Compte juste");
        chips[1].click();
        await fixture.whenStable();

        expect(el.querySelector(".change")).not.toBeNull();
    });

    it("should send a mobile money payment with its reference", async () => {
        await render();
        await add(0);

        [...el.querySelectorAll<HTMLButtonElement>(".method")][1].click();
        await fixture.whenStable();
        // la référence est obligatoire
        expect(submitBtn().disabled).toBe(true);
        const reference = el.querySelector<HTMLInputElement>(".payment input")!;
        reference.value = " PP123 ";
        reference.dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(text()).toContain("n'entre pas dans le tiroir-caisse");
        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith([{ productId: 3, quantity: 1 }], {
            paymentMethod: "MOBILE_MONEY",
            paymentReference: "PP123",
        });
    });
});

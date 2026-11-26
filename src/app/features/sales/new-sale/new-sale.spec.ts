import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { NewSale } from "./new-sale";
import { AuthService } from "../../../core/auth/auth.service";
import { CustomerService } from "../../../core/customers/customer.service";
import { SaleService } from "../../../core/sales/sale.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { Product } from "../../../core/stock/product.model";
import { ProductService } from "../../../core/stock/product.service";
import { NetworkService } from "../../../core/offline/network.service";
import { OfflineCatalogService } from "../../../core/offline/offline-catalog.service";
import { SaleOutboxService } from "../../../core/offline/sale-outbox.service";

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
    image: "data:image/png;base64,MINIATURE",
});
const savon = product(5, "Savon", { theoretical_stock: 0, stock_status: "OUT_OF_STOCK" });

const mireille = {
    id: 12,
    name: "Mireille Ngoma",
    phone: "+242066123456",
    note: null,
    is_active: true,
    created_at: "2026-01-01",
    purchases_count: 3,
    total_spent: 9000,
    due_amount: 2500,
    last_purchase_at: null,
};

let preselected: Product = bazin;

describe("NewSale", () => {
    let fixture: ComponentFixture<NewSale>;
    let el: HTMLElement;
    let createSale: ReturnType<typeof vi.fn>;

    // La plupart des tests passent par les carreaux ; sans choix mémorisé la vue dépend des photos
    beforeEach(() => localStorage.setItem("new-sale-view", "grid"));
    afterEach(() => localStorage.removeItem("new-sale-view"));

    async function render({
        isAdmin = false,
        productId = null as string | null,
        createFails = false,
        customerGone = false,
        customersFail = false,
    } = {}) {
        createSale = vi.fn(() =>
            customerGone
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 404,
                              error: { message: "Client introuvable ou désactivé." },
                          }),
                  )
                : createFails
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
                // Le catalogue de l'appareil et la file hors ligne ont leurs propres tests
                { provide: NetworkService, useValue: { online: signal(true) } },
                {
                    provide: OfflineCatalogService,
                    useValue: {
                        products: signal([]),
                        categories: signal([]),
                        savedAt: signal(null),
                        load: async () => {},
                        refresh: async () => {},
                    },
                },
                { provide: SaleOutboxService, useValue: { add: vi.fn(), count: signal(0) } },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap(productId ? { productId } : {}),
                        },
                    },
                },
                { provide: SaleService, useValue: { createSale } },
                {
                    provide: CustomerService,
                    useValue: {
                        getCustomers: () =>
                            customersFail
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of({ rows: [mireille], total: 1, page: 1, limit: 5 }),
                    },
                },
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
                        isOwner: signal(false),
                        user: signal({
                            id: 6,
                            name: "Adam K.",
                            email: "a@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(NewSale);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");
    const results = () => [...el.querySelectorAll<HTMLButtonElement>(".gmain")];
    const submitBtn = () => el.querySelector<HTMLButtonElement>(".cart-footer .submit")!;

    async function add(index: number) {
        results()[index].click();
        await fixture.whenStable();
    }

    // Le champ du prix négocié est replié tant qu'on ne clique pas sur le lien
    async function openPrice() {
        el.querySelector<HTMLButtonElement>(".price-link")!.click();
        await fixture.whenStable();
    }

    it("should add a product to the cart and compute the total", async () => {
        await render();
        // Sans produit, le pied du panier n'existe pas encore
        expect(el.querySelector(".cart-footer")).toBeNull();

        await add(0);
        el.querySelector<HTMLButtonElement>("[aria-label='Augmenter la quantité']")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".total")!.textContent!.replace(/\s/g, " ")).toContain("3 000 F");
        expect(results()[0].closest(".gtile")!.classList).toContain("in-cart");
        expect(submitBtn().disabled).toBe(false);
    });

    it("should show the discount between the subtotal and the total", async () => {
        await render();
        await add(1);
        expect(el.querySelector(".recap")).toBeNull();
        expect(el.querySelector(".price-input")).toBeNull();
        await openPrice();

        const price = el.querySelector<HTMLInputElement>(".price-input")!;
        price.value = "9000";
        price.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        const recap = el.querySelector(".recap")!.textContent!.replace(/\s/g, " ");
        expect(recap).toContain("10 000 F");
        expect(recap).toContain("1 000 F");
        expect(el.querySelector(".total")!.textContent!.replace(/\s/g, " ")).toContain("9 000 F");
    });

    it("should empty the cart with the clear button", async () => {
        await render();
        await add(0);
        await add(1);

        el.querySelector<HTMLButtonElement>(".cart-header .clear")!.click();
        await fixture.whenStable();

        expect(el.querySelectorAll(".line").length).toBe(0);
        expect(el.querySelector(".empty-cart")).not.toBeNull();
    });

    it("should show the product total on the encash button", async () => {
        await render();
        await add(0);

        expect(submitBtn().textContent!.replace(/\s/g, " ")).toContain("Encaisser 1 500 F");
    });

    it("should zoom on the photo without adding the product, then show the full photo", async () => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        preselected = { ...bazin, image: "data:image/png;base64,GRANDE" };
        await render();

        el.querySelectorAll<HTMLButtonElement>(".gcorner")[0].click();
        await fixture.whenStable();

        expect(el.querySelector("app-photo-zoom img")!.getAttribute("src")).toContain("GRANDE");
        expect(el.querySelectorAll(".line").length).toBe(0);
        // Un produit sans photo montre ses initiales, sans bouton de zoom
        expect(el.querySelectorAll(".gtile")[0].querySelector(".gcorner")).toBeNull();
        expect(el.querySelectorAll(".gtile")[0].querySelector(".gphoto")!.textContent).toContain(
            "RI",
        );

        preselected = bazin;
    });

    it("should not offer to add a photo from the cash register", async () => {
        await render({ isAdmin: true });

        expect(el.querySelector(".thumb-add, .gcorner-add")).toBeNull();
        expect(el.querySelector("input[type=file]")).toBeNull();
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
        await openPrice();

        const price = el.querySelector<HTMLInputElement>(".price-input")!;
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
    });

    it("should block a negotiated price below the minimum", async () => {
        await render();
        await add(1);
        await openPrice();

        const price = el.querySelector<HTMLInputElement>(".price-input")!;
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

    it("should never block the sale because of the cash register", async () => {
        await render();

        // Pas de message "caisse fermée" ni de bouton pour l'ouvrir : le serveur l'ouvre tout seul
        expect(el.querySelector(".catalog")).not.toBeNull();
        expect(text()).not.toContain("Caisse pas encore ouverte");
        expect(text()).not.toContain("Ouvrir la caisse");
        expect(text()).not.toContain("Caisse clôturée");
    });

    it("should stay on the cash register after the sale and offer the ticket", async () => {
        await render();
        await add(0);
        submitBtn().click();
        await fixture.whenStable();

        expect(el.querySelectorAll(".line").length).toBe(0);
        expect(el.querySelector(".cart")!.classList).toContain("cart-empty");
        const done = el.querySelector(".queued")!;
        expect(done.textContent!.replace(/\s/g, " ")).toContain("Encaissé · 1 500 F");
        expect(done.querySelector("a")!.getAttribute("href")).toBe("/sales/9");

        done.querySelector<HTMLButtonElement>("button")!.click();
        await fixture.whenStable();
        expect(el.querySelector(".queued")).toBeNull();
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
        expect(el.querySelector(".queued")).toBeNull();
        expect(el.querySelectorAll(".line").length).toBe(1);
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

        await openOther();
        const received = el.querySelector<HTMLInputElement>("input[placeholder='Montant reçu']")!;
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

        await openOther();
        const received = el.querySelector<HTMLInputElement>("input[placeholder='Montant reçu']")!;
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
        expect(chips[0].textContent).toContain("Montant exact");
        chips[1].click();
        await fixture.whenStable();

        expect(el.querySelector(".change")).not.toBeNull();
    });

    it("should send a mobile money payment without any reference", async () => {
        await render();
        await add(0);

        [...el.querySelectorAll<HTMLButtonElement>(".method")][1].click();
        await fixture.whenStable();
        expect(el.querySelector("input[placeholder^='Ex. PP']")).toBeNull();
        expect(submitBtn().disabled).toBe(false);

        expect(text()).not.toContain("tiroir-caisse");
        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith([{ productId: 3, quantity: 1 }], {
            paymentMethod: "MOBILE_MONEY",
        });
    });

    // Client et paiement partiel sont repliés : on les ouvre d'abord
    async function openMore() {
        el.querySelector<HTMLButtonElement>(".free-link")?.click();
        await fixture.whenStable();
    }

    // Le montant reçu libre est derrière le bouton "Autre"
    async function openOther() {
        [...el.querySelectorAll<HTMLButtonElement>(".chip")]
            .find((chip) => chip.textContent!.trim() === "Autre")!
            .click();
        await fixture.whenStable();
    }

    const type = async (selector: string, value: string) => {
        const input = el.querySelector<HTMLInputElement>(selector)!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    };

    const clientInput = "input[aria-label='Client, nom ou téléphone']";

    async function toggleDeposit() {
        await openMore();
        el.querySelector<HTMLButtonElement>(".switch")!.click();
        await fixture.whenStable();
    }

    it("should require a customer for a deposit", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type("input[placeholder^='Sur ']", "500");

        expect(text()).toContain("Indiquez le nom et le téléphone du client");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should send a deposit with the typed name and show the remaining amount", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type(clientInput, " Fatou Ndiaye ");
        await type("input[aria-label='Téléphone du client']", "06 61 23 456");
        await type("input[placeholder^='Sur ']", "500");

        expect(text()).toContain("Reste à payer");
        // Un seul champ de montant : le montant reçu disparaît
        expect(el.querySelector("#received")).toBeNull();
        expect(el.querySelector(".chips")).toBeNull();
        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith(
            [{ productId: 3, quantity: 1 }],
            expect.objectContaining({
                paymentMethod: "CASH",
                amountPaid: 500,
                amountReceived: 500,
                customerName: "Fatou Ndiaye",
                customerPhone: "06 61 23 456",
            }),
        );
    });

    it("should sell fully on credit when the deposit is left empty", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type(clientInput, "Fatou Ndiaye");
        await type("input[aria-label='Téléphone du client']", "06 61 23 456");

        expect(submitBtn().disabled).toBe(false);
        expect(submitBtn().textContent).toContain("Vendre à crédit");
        submitBtn().click();

        const payment = createSale.mock.calls[0][1];
        expect(payment.amountPaid).toBe(0);
        expect(payment.amountReceived).toBeUndefined();
    });

    it("should accept 0 as the deposit, still asking for a customer", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type("input[placeholder^='Sur ']", "0");

        expect(submitBtn().disabled).toBe(true);
        expect(text()).toContain("Indiquez le nom et le téléphone du client");
    });

    it("should send a typed number as the customer phone", async () => {
        await render();
        await add(0);
        await openMore();
        await type(clientInput, "06 61 23 456");
        submitBtn().click();

        const payment = createSale.mock.calls[0][1];
        expect(payment.customerPhone).toBe("06 61 23 456");
        expect(payment.customerName).toBeUndefined();
    });

    it("should send the customer id and show what the customer already owes", async () => {
        await render();
        await add(0);
        await openPicker();
        el.querySelector<HTMLButtonElement>(".picker-row")!.click();
        await fixture.whenStable();

        expect(text()).toContain("Mireille Ngoma");
        expect(text()).toContain("Doit déjà 2 500 F");

        submitBtn().click();
        const payment = createSale.mock.calls[0][1];
        expect(payment.customerId).toBe(12);
        expect(payment.customerName).toBeUndefined();
        expect(payment.customerPhone).toBeUndefined();
    });

    async function openPicker() {
        await openMore();
        el.querySelector<HTMLInputElement>(".picker input")!.dispatchEvent(new Event("focus"));
        await fixture.whenStable();
    }

    it("should list recent customers as soon as the field gets the focus", async () => {
        await render();
        await add(0);
        expect(el.querySelector("#customer-list")).toBeNull();
        await openPicker();

        expect(el.querySelector("#customer-list")).not.toBeNull();
        expect(el.querySelector(".picker-row")!.textContent).toContain("Mireille Ngoma");
    });

    it("should expose the customer picker as a combobox and close it with Escape", async () => {
        await render();
        await add(0);
        await openPicker();
        const input = el.querySelector<HTMLInputElement>(".picker input")!;

        expect(input.getAttribute("role")).toBe("combobox");
        expect(input.getAttribute("aria-expanded")).toBe("true");
        expect(el.querySelector("#customer-list")!.getAttribute("role")).toBe("listbox");
        expect(el.querySelector(".picker-row")!.getAttribute("role")).toBe("option");

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await fixture.whenStable();

        expect(el.querySelector("#customer-list")).toBeNull();
        expect(input.getAttribute("aria-expanded")).toBe("false");
    });

    it("should close the picker on a click elsewhere but not inside it", async () => {
        await render();
        await add(0);
        await openPicker();

        el.querySelector<HTMLElement>(".picker-list")!.click();
        await fixture.whenStable();
        expect(el.querySelector("#customer-list")).not.toBeNull();

        document.body.click();
        await fixture.whenStable();
        expect(el.querySelector("#customer-list")).toBeNull();
    });

    it("should tell the search failed instead of listing nothing", async () => {
        await render({ customersFail: true });
        await add(0);
        await openPicker();

        expect(el.querySelector(".picker-error")!.getAttribute("role")).toBe("alert");
        expect(text()).toContain("Impossible de charger les clients");
        expect(text()).toContain("Réessayer");
    });

    it("should drop the chosen customer when the API says it is gone", async () => {
        await render({ customerGone: true });
        await add(0);
        await openPicker();
        el.querySelector<HTMLButtonElement>(".picker-row")!.click();
        await fixture.whenStable();
        expect(text()).toContain("Mireille Ngoma");

        submitBtn().click();
        await fixture.whenStable();

        expect(text()).toContain("Ce client n'existe plus ou a été désactivé");
        expect(el.querySelector(".picked")).toBeNull();
        expect(el.querySelector(".picker input")).not.toBeNull();
    });

    it("should accept a deposit when a customer card is chosen", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await openPicker();
        el.querySelector<HTMLButtonElement>(".picker-row")!.click();
        await fixture.whenStable();
        await type("input[placeholder^='Sur ']", "500");

        expect(text()).not.toContain("Indiquez le nom ou le téléphone");
        expect(submitBtn().disabled).toBe(false);
    });

    it("should keep the cart readable with a summary of the deposit instead of the fields", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type(clientInput, "Fatou Ndiaye");
        await type("input[aria-label='Téléphone du client']", "06 61 23 456");
        await type("input[placeholder^='Sur ']", "500");

        const cart = el.querySelector<HTMLElement>(".cart")!;
        expect(cart.querySelector(".credit-recap")!.textContent).toContain("Fatou Ndiaye");
        expect(cart.querySelector(".credit-recap")!.textContent).toContain("reste");
        expect(cart.querySelector("input[placeholder^='Sur ']")).toBeNull();
        expect(cart.querySelector("input[aria-label='Téléphone du client']")).toBeNull();
    });

    it("should send both the name and the phone of a sale without a deposit", async () => {
        await render();
        await add(0);
        await openMore();
        await type(clientInput, "Fatou Ndiaye");
        await type("input[aria-label='Téléphone du client']", "06 61 23 456");
        submitBtn().click();

        const payment = createSale.mock.calls[0][1];
        expect(payment.customerName).toBe("Fatou Ndiaye");
        expect(payment.customerPhone).toBe("06 61 23 456");
    });

    it("should write the deposit placeholder as an amount in francs", async () => {
        await render();
        await add(0);
        await toggleDeposit();

        const placeholder = el.querySelector<HTMLInputElement>(
            "input[placeholder^='Sur ']",
        )!.placeholder;
        expect(placeholder.replace(/\s/g, "")).toMatch(/^Sur\d+F/);
    });

    it("should refuse a deposit above the total", async () => {
        await render();
        await add(0);
        await toggleDeposit();
        await type("input[placeholder^='Sur ']", "999999");

        expect(text()).toContain("L'acompte dépasse le total");
        expect(submitBtn().disabled).toBe(true);
    });

    describe("carreaux", () => {
        const tiles = () => [...el.querySelectorAll<HTMLElement>(".gtile")];

        it("should show lines first when less than half of the products have a photo", async () => {
            localStorage.removeItem("new-sale-view");
            await render();

            expect(el.querySelectorAll(".tile").length).toBe(3);
            expect(tiles().length).toBe(0);
        });

        it("should show tiles first, then switch to lines and back with the single button", async () => {
            await render();
            expect(tiles().length).toBe(3);
            expect(el.querySelector(".tiles")).toBeNull();

            el.querySelector<HTMLButtonElement>(".view-single")!.click();
            await fixture.whenStable();
            expect(el.querySelectorAll(".tile").length).toBe(3);
            expect(tiles().length).toBe(0);

            el.querySelector<HTMLButtonElement>(".view-single")!.click();
            await fixture.whenStable();
            expect(tiles().length).toBe(3);
        });

        it("should add one more at each tap in the lines view and take one off with the minus button", async () => {
            localStorage.setItem("new-sale-view", "list");
            await render();

            const tap = async () => {
                el.querySelector<HTMLButtonElement>(".tile .result")!.click();
                await fixture.whenStable();
            };
            await tap();
            await tap();
            expect(el.querySelector(".tile .add")!.textContent).toContain("2");
            expect(el.querySelector(".stepper input")).toHaveProperty("value", "2");

            el.querySelector<HTMLButtonElement>(".tile .minus")!.click();
            await fixture.whenStable();
            expect(el.querySelector(".tile .add")!.textContent).toContain("1");

            el.querySelector<HTMLButtonElement>(".tile .minus")!.click();
            await fixture.whenStable();
            expect(el.querySelector(".tile .minus")).toBeNull();
            expect(el.querySelectorAll(".line").length).toBe(0);
        });

        it("should add one more at each tap and show the quantity, then take one off", async () => {
            await render();

            const tap = async () => {
                tiles()[0].querySelector<HTMLButtonElement>(".gmain")!.click();
                await fixture.whenStable();
            };
            await tap();
            await tap();

            expect(tiles()[0].querySelector(".gqty")!.textContent).toContain("2");
            expect(el.querySelector(".stepper input")).toHaveProperty("value", "2");

            tiles()[0].querySelector<HTMLButtonElement>(".gqty button")!.click();
            await fixture.whenStable();
            expect(tiles()[0].querySelector(".gqty")!.textContent).toContain("1");

            tiles()[0].querySelector<HTMLButtonElement>(".gqty button")!.click();
            await fixture.whenStable();
            expect(tiles()[0].querySelector(".gqty")).toBeNull();
            expect(el.querySelectorAll(".line").length).toBe(0);
        });

        it("should disable an out of stock tile and keep the photo zoom apart", async () => {
            await render();

            expect(tiles()[2].querySelector<HTMLButtonElement>(".gmain")!.disabled).toBe(true);
            expect(tiles()[2].textContent).toContain("Rupture");

            tiles()[1].querySelector<HTMLButtonElement>(".gcorner")!.click();
            await fixture.whenStable();
            expect(el.querySelectorAll(".line").length).toBe(0);
        });
    });

    describe("feuille du panier", () => {
        it("should open from the bar without moving the page, and close with the cross", async () => {
            await render();
            await add(0);
            const scroll = vi.fn();
            Element.prototype.scrollIntoView = scroll;

            el.querySelector<HTMLButtonElement>(".bar-info")!.click();
            await fixture.whenStable();
            expect(el.querySelector(".cart")!.classList).toContain("open");
            expect(el.querySelector(".cart-bar")).toBeNull();

            el.querySelector<HTMLButtonElement>(".sheet-close")!.click();
            // Le retour d'historique est asynchrone
            await new Promise((resolve) => setTimeout(resolve, 100));
            await fixture.whenStable();
            expect(el.querySelector(".cart")!.classList).not.toContain("open");
            expect(scroll).not.toHaveBeenCalled();
        });

        it("should close on the back button", async () => {
            await render();
            await add(0);
            el.querySelector<HTMLButtonElement>(".bar-info")!.click();
            await fixture.whenStable();

            window.dispatchEvent(new PopStateEvent("popstate"));
            await fixture.whenStable();

            expect(el.querySelector(".cart")!.classList).not.toContain("open");
        });

        it("should open the cart from the bar button without encashing", async () => {
            await render();
            await add(0);

            const bar = el.querySelector<HTMLButtonElement>(".cart-bar .bar-ghost")!;
            expect(bar.textContent).toContain("Panier");
            expect(el.querySelector(".cart-bar")!.textContent).toContain("1 article");
            bar.click();
            await fixture.whenStable();

            expect(createSale).not.toHaveBeenCalled();
            expect(el.querySelector(".cart")!.classList).toContain("open");
            // Le panier contient le paiement : le fond s'assombrit comme pour une fenêtre
            expect(el.querySelector(".sheet-backdrop")).not.toBeNull();
        });

        it("should encash at once from the bar with the default payment", async () => {
            await render();
            await add(0);

            el.querySelector<HTMLButtonElement>(".cart-bar .bar-btn:not(.bar-ghost)")!.click();
            await fixture.whenStable();

            expect(createSale).toHaveBeenCalledWith([{ productId: 3, quantity: 1 }], {
                paymentMethod: "CASH",
                amountReceived: 1500,
            });
            expect(el.querySelector(".queued")).not.toBeNull();
        });

        it("should open the cart instead of encashing when a line is wrong", async () => {
            await render();
            await add(0);
            const qty = el.querySelector<HTMLInputElement>(".stepper input")!;
            qty.value = "11";
            qty.dispatchEvent(new Event("change"));
            await fixture.whenStable();

            el.querySelector<HTMLButtonElement>(".cart-bar .bar-btn:not(.bar-ghost)")!.click();
            await fixture.whenStable();

            expect(createSale).not.toHaveBeenCalled();
            expect(el.querySelector(".cart")!.classList).toContain("open");
        });

        it("should go back only once in the history when the sale is done from the sheet", async () => {
            await render();
            await add(0);
            el.querySelector<HTMLButtonElement>(".bar-info")!.click();
            await fixture.whenStable();
            const back = vi.spyOn(history, "back");
            const go = vi.spyOn(history, "go");

            submitBtn().click();
            await fixture.whenStable();

            expect(back.mock.calls.length + go.mock.calls.length).toBeLessThanOrEqual(1);
            back.mockRestore();
            go.mockRestore();
        });

        it("should still open the cart when the sale is not ready", async () => {
            await render();
            await add(0);

            const bar = el.querySelector<HTMLButtonElement>(".cart-bar .bar-ghost")!;
            bar.click();
            await fixture.whenStable();

            expect(createSale).not.toHaveBeenCalled();
            expect(el.querySelector(".cart")!.classList).toContain("open");
        });
    });

    it("should suggest bills adapted to the total", async () => {
        await render();
        await add(1);
        const chips = () =>
            [...el.querySelectorAll<HTMLButtonElement>(".chips .chip")].map((c) =>
                c.textContent!.replace(/\s/g, " ").trim(),
            );

        expect(chips()).toEqual(["Montant exact", "20 000 F", "50 000 F", "Autre"]);
    });

    it("should show a big change and say when the amount is exact", async () => {
        await render();
        await add(0);
        await openOther();
        await type("input[placeholder='Montant reçu']", "1500");

        expect(el.querySelector(".change")!.textContent).toContain("Compte juste");
    });

    it("should encash with the Enter key from the received amount", async () => {
        await render();
        await add(0);
        await openOther();

        el.querySelector<HTMLInputElement>("#received")!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );

        expect(createSale).toHaveBeenCalledTimes(1);
    });

    it("should focus the search with the slash key", async () => {
        await render();
        fixture.detectChanges();
        const search = el.querySelector<HTMLInputElement>(".search input")!;

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));

        expect(document.activeElement).toBe(search);
    });
});

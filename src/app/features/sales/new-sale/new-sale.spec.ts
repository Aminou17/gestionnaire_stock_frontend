import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { NewSale } from "./new-sale";
import { AuthService } from "../../../core/auth/auth.service";
import { CashSessionService, TodayCash } from "../../../core/cash/cash-session.service";
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
    let navigate: ReturnType<typeof vi.fn>;
    let setImage: ReturnType<typeof vi.fn>;

    async function render({
        cash = { status: "OPEN", balance: 1000 } as TodayCash | null,
        isAdmin = false,
        productId = null as string | null,
        createFails = false,
        customerGone = false,
        customersFail = false,
    } = {}) {
        setImage = vi.fn(() => of({ id: 1, image: "data:image/jpeg;base64,NEUVE" }));
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
                // le catalogue de l'appareil et la file hors ligne ont leurs propres tests
                { provide: NetworkService, useValue: { online: signal(true) } },
                {
                    provide: OfflineCatalogService,
                    useValue: {
                        products: signal([]),
                        categories: signal([]),
                        cash: signal(null),
                        savedAt: signal(null),
                        load: async () => {},
                        refresh: async () => {},
                        saveCash: async () => {},
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
                { provide: CashSessionService, useValue: { getTodayCash: () => of(cash) } },
                {
                    provide: ProductService,
                    useValue: {
                        getProducts: () =>
                            of({ data: [riz, bazin, savon], total: 3, counters: {} }),
                        getProduct: () => of(preselected),
                        setImage,
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
                            name: "Awa K.",
                            email: "a@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
            ],
        }).compileComponents();

        navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true) as never;
        fixture = TestBed.createComponent(NewSale);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    // les options avancées sont repliées : on les déplie avant de s'en servir
    async function openMore() {
        el.querySelector<HTMLButtonElement>(".more-toggle")?.click();
        await fixture.whenStable();
    }

    // les tests d'ajout passent par la liste en lignes
    beforeEach(() => localStorage.setItem("new-sale-view", "list"));
    afterAll(() => localStorage.removeItem("new-sale-view"));

    const text = () => el.textContent!.replace(/\s/g, " ");
    const results = () => [...el.querySelectorAll<HTMLButtonElement>(".result")];
    const submitBtn = () => el.querySelector<HTMLButtonElement>(".cart-footer .submit")!;

    async function add(index: number) {
        results()[index].click();
        await fixture.whenStable();
    }

    // le champ du prix négocié est replié tant qu'on ne clique pas sur le lien
    async function openPrice() {
        el.querySelector<HTMLButtonElement>(".price-link")!.click();
        await fixture.whenStable();
    }

    it("should add a product to the cart and compute the total", async () => {
        await render();
        // sans produit, le pied du panier n'existe pas encore
        expect(el.querySelector(".cart-footer")).toBeNull();

        await add(0);
        el.querySelector<HTMLButtonElement>("[aria-label='Augmenter la quantité']")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".total")!.textContent!.replace(/\s/g, " ")).toContain("3 000 F");
        expect(results()[0].closest(".tile")!.classList).toContain("in-cart");
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

        el.querySelector<HTMLButtonElement>(".thumb-zoom")!.click();
        await fixture.whenStable();

        expect(el.querySelector("app-photo-zoom img")!.getAttribute("src")).toContain("GRANDE");
        expect(el.querySelectorAll(".line").length).toBe(0);
        // une ligne sans photo montre ses initiales, sans bouton
        expect(el.querySelectorAll(".tile")[0].querySelector(".thumb-zoom")).toBeNull();
        expect(el.querySelectorAll(".tile")[0].querySelector(".thumb")!.textContent).toContain(
            "RI",
        );

        preselected = bazin;
    });

    it("should offer the admin to add a photo and show it at once", async () => {
        await render({ isAdmin: true });
        // le redimensionnement passe par un canvas : on le remplace dans le test
        (fixture.componentInstance as unknown as { resize: unknown }).resize = () =>
            Promise.resolve("data:image/jpeg;base64,NEUVE");

        const add = el.querySelector<HTMLButtonElement>(".tile .thumb-add")!;
        expect(add.getAttribute("aria-label")).toBe("Ajouter une photo pour Riz");

        const input = el.querySelector<HTMLInputElement>("input[type=file]")!;
        const file = new File(["x"], "riz.jpg", { type: "image/jpeg" });
        Object.defineProperty(input, "files", { value: [file] });
        add.click();
        input.dispatchEvent(new Event("change"));
        await vi.waitFor(() => expect(setImage).toHaveBeenCalled());
        await fixture.whenStable();

        expect(setImage.mock.calls[0][0]).toBe(riz.id);
        expect(el.querySelector(".tile .thumb-zoom img")).not.toBeNull();
        expect(el.querySelector(".photo-notice")!.textContent).toContain("Photo ajoutée");
    });

    it("should not offer the manager to add a photo", async () => {
        await render();

        expect(el.querySelector(".thumb-add")).toBeNull();
        expect(el.querySelector("input[type=file]")).not.toBeNull();
    });

    it("should remove the product when its tile is clicked again", async () => {
        await render();
        await add(0);
        expect(el.querySelectorAll(".line").length).toBe(1);

        await add(0);
        expect(el.querySelectorAll(".line").length).toBe(0);
        expect(results()[0].closest(".tile")!.classList).not.toContain("in-cart");
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
        expect(navigate).toHaveBeenCalledWith(["/sales", 9], {
            state: { created: true },
            replaceUrl: false,
        });
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

    it("should tell the manager to ask the owner when the cash register is closed", async () => {
        await render({ cash: null });
        await add(0);

        expect(text()).toContain("ouvrez-la pour enregistrer une vente");
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

        const received = el.querySelector<HTMLInputElement>("input[placeholder='Ex. 10 000']")!;
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

        const received = el.querySelector<HTMLInputElement>("input[placeholder='Ex. 10 000']")!;
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

    const type = async (selector: string, value: string) => {
        const input = el.querySelector<HTMLInputElement>(selector)!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    };

    it("should require a customer for a deposit", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".option-deposit")!.click();
        await fixture.whenStable();
        await type("input[placeholder^='Tout payer']", "500");

        expect(text()).toContain("Indiquez le nom ou le téléphone du client");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should send a deposit with the customer and show the remaining amount", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".free-link")!.click();
        await fixture.whenStable();
        await type("input[placeholder='Nom du client']", " Fatou Ndiaye ");
        await openMore();
        el.querySelector<HTMLButtonElement>(".option-deposit")!.click();
        await fixture.whenStable();
        await type("input[placeholder^='Tout payer']", "500");

        expect(text()).toContain("Reste à payer");
        submitBtn().click();
        expect(createSale).toHaveBeenCalledWith(
            [{ productId: 3, quantity: 1 }],
            expect.objectContaining({
                paymentMethod: "CASH",
                amountPaid: 500,
                amountReceived: 500,
                customerName: "Fatou Ndiaye",
            }),
        );
    });

    it("should send the customer id and show what the customer already owes", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLInputElement>(".picker input")!.dispatchEvent(new Event("focus"));
        await fixture.whenStable();
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

    it("should list recent customers as soon as the customer block opens", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();

        expect(el.querySelector("#customer-list")).not.toBeNull();
        expect(el.querySelector(".picker-row")!.textContent).toContain("Mireille Ngoma");
    });

    it("should offer the matching customer when a known phone is typed in free entry", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".free-link")!.click();
        await fixture.whenStable();
        await type("input[placeholder='Téléphone']", "06 61 23 456");
        await new Promise((resolve) => setTimeout(resolve, 350));
        await fixture.whenStable();

        expect(el.querySelector(".match")!.textContent).toContain("C'est Mireille Ngoma ?");

        el.querySelector<HTMLButtonElement>(".match button")!.click();
        await fixture.whenStable();
        submitBtn().click();
        expect(createSale.mock.calls[0][1].customerId).toBe(12);
    });

    async function openPicker() {
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLInputElement>(".picker input")!.dispatchEvent(new Event("focus"));
        await fixture.whenStable();
    }

    it("should expose the customer picker as a combobox and close it with Escape", async () => {
        await render();
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
        await openPicker();

        el.querySelector<HTMLElement>(".picker-list")!.click();
        await fixture.whenStable();
        expect(el.querySelector("#customer-list")).not.toBeNull();

        document.body.click();
        await fixture.whenStable();
        expect(el.querySelector("#customer-list")).toBeNull();
    });

    it("should tell the search failed instead of saying no customer was found", async () => {
        await render({ customersFail: true });
        await openPicker();

        expect(el.querySelector(".picker-error")!.getAttribute("role")).toBe("alert");
        expect(text()).toContain("Impossible de charger les clients");
        expect(text()).not.toContain("Aucun client trouvé");
        expect(text()).toContain("Réessayer");
    });

    it("should drop the chosen customer when the API says it is gone", async () => {
        await render({ customerGone: true });
        await openPicker();
        el.querySelector<HTMLButtonElement>(".picker-row")!.click();
        await fixture.whenStable();
        expect(text()).toContain("Mireille Ngoma");

        submitBtn().click();
        await fixture.whenStable();

        expect(text()).toContain("Ce client n'existe plus ou a été désactivé");
        expect(el.querySelector(".picked")).toBeNull();
        expect(el.querySelector(".picker input")).not.toBeNull();
        expect(navigate).not.toHaveBeenCalled();
    });

    it("should accept a deposit when a customer card is chosen", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".option-deposit")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLInputElement>(".picker input")!.dispatchEvent(new Event("focus"));
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".picker-row")!.click();
        await fixture.whenStable();
        await type("input[placeholder^='Tout payer']", "500");

        expect(text()).not.toContain("Indiquez le nom ou le téléphone");
        expect(submitBtn().disabled).toBe(false);
    });

    it("should refuse a deposit above the total", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".option-deposit")!.click();
        await fixture.whenStable();
        await type("input[placeholder^='Tout payer']", "999999");

        expect(text()).toContain("L'acompte dépasse le total");
        expect(submitBtn().disabled).toBe(true);
    });

    it("should send a second payment for a mixed payment", async () => {
        await render();
        await add(0);
        await openMore();
        el.querySelector<HTMLButtonElement>(".add-customer")!.click();
        await fixture.whenStable();
        await openMore();
        el.querySelector<HTMLButtonElement>(".option-split")!.click();
        await fixture.whenStable();
        await type("input[placeholder='Ex. 5000']", "1000");

        expect(text()).toContain("Reste en Mobile Money");
        submitBtn().click();
        const payment = createSale.mock.calls[0][1];
        expect(payment.amountPaid).toBe(1000);
        expect(payment.secondPayment).toEqual({
            paymentMethod: "MOBILE_MONEY",
            amountPaid: payment.secondPayment.amountPaid,
        });
    });

    describe("carreaux", () => {
        const gridButton = () =>
            el.querySelector<HTMLButtonElement>(
                ".view-toggle button[aria-label='Vue en carreaux']",
            )!;
        const listButton = () =>
            el.querySelector<HTMLButtonElement>(".view-toggle button[aria-label='Vue en lignes']")!;
        const tiles = () => [...el.querySelectorAll<HTMLElement>(".gtile")];

        beforeEach(() => localStorage.removeItem("new-sale-view"));
        afterAll(() => localStorage.removeItem("new-sale-view"));

        it("should switch to tiles and remember the choice", async () => {
            await render();
            expect(tiles().length).toBe(3);
            expect(el.querySelectorAll(".tile").length).toBe(0);

            listButton().click();
            await fixture.whenStable();

            expect(tiles().length).toBe(0);
            expect(localStorage.getItem("new-sale-view")).toBe("list");

            fixture.destroy();
            TestBed.resetTestingModule();
            await render();
            expect(tiles().length).toBe(0);
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
            gridButton().click();
            await fixture.whenStable();

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
            // le retour d'historique est asynchrone
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

            const bar = el.querySelector<HTMLButtonElement>(".cart-bar .bar-btn")!;
            expect(bar.textContent).toContain("Voir le panier");
            expect(el.querySelector(".cart-bar")!.textContent).toContain("1 article");
            bar.click();
            await fixture.whenStable();

            expect(createSale).not.toHaveBeenCalled();
            expect(el.querySelector(".cart")!.classList).toContain("open");
            expect(el.querySelector(".cart")!.classList).not.toContain("paying");
            // pas de fond assombri pendant le panier : le catalogue reste utilisable
            expect(el.querySelector(".sheet-backdrop")).toBeNull();
        });

        it("should go to the payment step, then come back to the cart", async () => {
            await render();
            await add(0);
            el.querySelector<HTMLButtonElement>(".bar-btn")!.click();
            await fixture.whenStable();

            el.querySelector<HTMLButtonElement>(".to-pay")!.click();
            await fixture.whenStable();
            expect(el.querySelector(".cart")!.classList).toContain("paying");
            expect(el.querySelector(".sheet-backdrop")).not.toBeNull();
            expect(createSale).not.toHaveBeenCalled();

            // le bouton retour du téléphone revient au panier sans le fermer
            history.back();
            await new Promise((resolve) => setTimeout(resolve, 100));
            await fixture.whenStable();
            expect(el.querySelector(".cart")!.classList).toContain("open");
            expect(el.querySelector(".cart")!.classList).not.toContain("paying");
        });

        it("should still open the cart when the sale is not ready", async () => {
            await render({ cash: null });
            await add(0);

            const bar = el.querySelector<HTMLButtonElement>(".cart-bar .bar-btn")!;
            bar.click();
            await fixture.whenStable();

            expect(createSale).not.toHaveBeenCalled();
            expect(el.querySelector(".cart")!.classList).toContain("open");
        });
    });

    it("should open the cash dialog from the banner and refresh the cash", async () => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        await render({ cash: null });
        const dialog = el.querySelector("app-open-cash-dialog dialog")!;
        expect(dialog.hasAttribute("open")).toBe(false);

        el.querySelector<HTMLButtonElement>(".banner .link-btn")!.click();
        await fixture.whenStable();

        expect(dialog.hasAttribute("open")).toBe(true);
        expect(el.querySelector(".banner a")).toBeNull();
    });

    it("should suggest bills adapted to the total", async () => {
        await render();
        await add(1);
        const chips = () =>
            [...el.querySelectorAll<HTMLButtonElement>(".chips .chip")].map((c) =>
                c.textContent!.replace(/\s/g, " ").trim(),
            );

        expect(chips()).toEqual(["Montant exact", "20 000 F", "50 000 F"]);
    });

    it("should show a big change and say when the amount is exact", async () => {
        await render();
        await add(0);
        await type("input[placeholder='Ex. 10 000']", "1500");

        expect(el.querySelector(".change")!.textContent).toContain("Compte juste");
    });

    it("should encash with the Enter key from the received amount", async () => {
        await render();
        await add(0);

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

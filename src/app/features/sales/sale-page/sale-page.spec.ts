import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { SalePage } from "./sale-page";
import { AuthService } from "../../../core/auth/auth.service";
import { SaleDetail } from "../../../core/sales/sale.model";
import { SaleService } from "../../../core/sales/sale.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

const detail = (overrides: Partial<SaleDetail> = {}): SaleDetail => ({
    id: 6,
    user_id: 6,
    user_name: "Awa K.",
    user_role: "manager",
    total: 11000,
    paid_amount: 11000,
    payments: [],
    returns: [],
    returned_amount: 0,
    status: "ACTIVE",
    created_at: "2026-11-02T10:15:00",
    cancelled_at: null,
    cancellation_reason: null,
    cancelled_by_name: null,
    payment_method: "CASH",
    amount_received: 15000,
    previous_id: 5,
    next_id: null,
    movements: [
        {
            id: 30,
            product_id: 3,
            product_name: "Riz",
            type: "SALE",
            quantity: 1,
            reference_type: "sale",
            reference_id: 6,
            stock_after: 42,
            created_at: "2026-11-02T10:15:00",
        },
    ],
    items: [
        {
            id: 1,
            product_id: 3,
            product_name: "Riz",
            quantity: 1,
            unit_price: 1500,
            reference_price: 1500,
            discount_amount: 0,
        },
        {
            id: 2,
            product_id: 4,
            product_name: "Bazin riche",
            quantity: 1,
            unit_price: 9500,
            reference_price: 10000,
            discount_amount: 500,
        },
    ],
    ...overrides,
});

describe("SalePage", () => {
    let fixture: ComponentFixture<SalePage>;
    let el: HTMLElement;
    let cancelSale: ReturnType<typeof vi.fn>;
    let returnItem: ReturnType<typeof vi.fn>;

    async function render({
        isAdmin = true,
        sale = detail(),
        status = 0,
        salesSettingsError = false,
    } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
        cancelSale = vi.fn(() => of({ message: "ok" }));
        returnItem = vi.fn(() => of({ amount: 1500, cashRefunded: 1500, otherRefunded: 0 }));

        await TestBed.configureTestingModule({
            imports: [SalePage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "6" })) },
                },
                {
                    provide: SaleService,
                    useValue: {
                        getSale: () =>
                            status
                                ? throwError(() => new HttpErrorResponse({ status, error: {} }))
                                : of(sale),
                        cancelSale,
                        returnItem,
                    },
                },
                {
                    provide: ShopSettingsService,
                    useValue: {
                        getSettings: () =>
                            of({
                                name: "Awa Bazin",
                                address: "Grand marché",
                                phone: "70 00 00 00",
                                tax_id: "IFU123",
                                rccm: null,
                                receipt_footer: "Ni repris ni échangé.",
                                updated_at: null,
                            }),
                    },
                },
                {
                    provide: SalesSettingsService,
                    useValue: {
                        getSettings: () =>
                            salesSettingsError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of({ ticket_prefix: "AB", default_max_discount: null }),
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
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SalePage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should list the products sold with the discount and the total", async () => {
        await render();

        expect(text()).toContain("Vente #6");
        expect(text()).toContain("Bazin riche");
        expect(text()).toContain("remise de 500 F sur 10 000 F");
        expect(text()).toContain("11 000 F");
        expect(text()).toContain("Awa K.");
    });

    it("should let only the owner refund an active sale", async () => {
        await render();
        expect(el.querySelector(".refund-btn")).not.toBeNull();

        TestBed.resetTestingModule();
        await render({ isAdmin: false });
        expect(el.querySelector(".refund-btn")).toBeNull();
        expect(text()).not.toContain("Vendeur");
    });

    it("should require a reason before refunding", async () => {
        await render();
        el.querySelector<HTMLButtonElement>(".refund-btn")!.click();
        el.querySelector<HTMLButtonElement>("dialog button[type='submit']")!.click();
        await fixture.whenStable();

        expect(cancelSale).not.toHaveBeenCalled();
        expect(text()).toContain("Le motif est obligatoire.");

        const reason = el.querySelector<HTMLTextAreaElement>("dialog textarea")!;
        reason.value = "Article défectueux";
        reason.dispatchEvent(new Event("input"));
        el.querySelector<HTMLButtonElement>("dialog button[type='submit']")!.click();

        expect(cancelSale).toHaveBeenCalledWith(6, "Article défectueux");
    });

    const returnButtons = () =>
        Array.from(el.querySelectorAll<HTMLButtonElement>(".items .link-btn"));

    it("should let only the owner return an item of a settled sale", async () => {
        await render();
        expect(returnButtons().length).toBe(2);

        TestBed.resetTestingModule();
        await render({ isAdmin: false });
        expect(returnButtons().length).toBe(0);

        TestBed.resetTestingModule();
        await render({ sale: detail({ paid_amount: 5000 }) });
        expect(returnButtons().length).toBe(0);
    });

    it("should return an item with a reason", async () => {
        await render();
        returnButtons()[0].click();
        await fixture.whenStable();

        const form = el.querySelector<HTMLFormElement>("#return-title")!.closest("form")!;
        form.querySelector<HTMLButtonElement>("button[type='submit']")!.click();
        await fixture.whenStable();
        expect(returnItem).not.toHaveBeenCalled();
        expect(text()).toContain("Le motif du retour est obligatoire.");

        const reason = form.querySelector<HTMLInputElement>("input[type='text']")!;
        reason.value = "Couleur non conforme";
        reason.dispatchEvent(new Event("input"));
        form.querySelector<HTMLButtonElement>("button[type='submit']")!.click();

        expect(returnItem).toHaveBeenCalledWith(6, {
            productId: 3,
            quantity: 1,
            reason: "Couleur non conforme",
        });
    });

    it("should list the returned items and stop offering what was already returned", async () => {
        await render({
            sale: detail({
                returned_amount: 1500,
                returns: [
                    {
                        id: 1,
                        product_id: 3,
                        product_name: "Riz",
                        quantity: 1,
                        amount: 1500,
                        cash_refunded: 1500,
                        other_refunded: 0,
                        reason: "Couleur non conforme",
                        user_name: "Yabre M.",
                        created_at: "2026-11-02T11:00:00",
                    },
                ],
            }),
        });

        expect(text()).toContain("1 × Riz");
        expect(returnButtons().length).toBe(1);
        // le net remplace le total en haut et dans la carte Paiement
        expect(text()).toContain("Net");
        expect(text()).toContain("rendus");
        expect(el.querySelector(".total strong")!.textContent!.replace(/\s/g, " ")).not.toBe("");
        // le retour apparaît aussi dans l'activité, avec son motif
        expect(el.querySelector(".timeline")!.textContent).toContain("Rendu : 1 × Riz");
        expect(el.querySelector(".timeline")!.textContent).toContain("Couleur non conforme");
    });

    it("should explain a refunded sale", async () => {
        await render({
            sale: detail({
                status: "CANCELLED",
                cancelled_at: "2026-11-02T11:00:00",
                cancelled_by_name: "Yabre M.",
                cancellation_reason: "Erreur de saisie",
            }),
        });

        expect(text()).toContain("Remboursée");
        expect(text()).toContain("par Yabre M.");
        expect(text()).toContain("Motif : Erreur de saisie");
        expect(el.querySelector(".refund-btn")).toBeNull();
    });

    it("should say when the sale does not exist", async () => {
        await render({ status: 404 });
        expect(text()).toContain("Cette vente est introuvable.");
    });

    it("should show the status, the history and the linked stock movements", async () => {
        await render();

        expect(text()).toContain("Payée");
        expect(text()).toContain("Vente enregistrée");
        const move = el.querySelector(".timeline .move")!.textContent!.replace(/\s+/g, " ");
        expect(move).toContain("Riz");
        expect(move).toContain("−1 · stock 43 → 42");
        expect(text()).not.toContain("Vente remboursée");
    });

    it("should add the refund to the history and to the movements", async () => {
        await render({
            sale: detail({
                status: "CANCELLED",
                cancelled_at: "2026-11-02T11:00:00",
                movements: [
                    {
                        id: 31,
                        product_id: 3,
                        product_name: "Riz",
                        type: "ADJUSTMENT",
                        quantity: 1,
                        reference_type: "SALE_CANCELLATION",
                        reference_id: 6,
                        stock_after: 43,
                        created_at: "2026-11-02T11:00:00",
                    },
                ],
            }),
        });

        expect(el.querySelector(".timeline")!.textContent).toContain("Vente remboursée");
        const moves = el.querySelectorAll(".timeline .move");
        expect(moves.length).toBe(1);
        expect(moves[0].textContent!.replace(/\s+/g, " ")).toContain("+1 · stock 42 → 43");
    });

    it("should link to the previous sale and disable the next one when there is none", async () => {
        await render();

        const links = el.querySelectorAll<HTMLAnchorElement>(".pager a.pager-btn");
        expect(links.length).toBe(1);
        expect(links[0].getAttribute("href")).toBe("/sales/5");
        expect(el.querySelectorAll(".pager .disabled").length).toBe(1);
    });

    it("should show the subtotal and the discounts when a discount was given", async () => {
        await render();

        const subtotals = el.querySelector(".subtotals")!.textContent!.replace(/\s/g, " ");
        expect(subtotals).toContain("11 500 F");
        expect(subtotals).toContain("−500 F");
    });

    it("should block the printing when the ticket settings cannot be loaded", async () => {
        await render({ salesSettingsError: true });

        const buttons = [...el.querySelectorAll<HTMLButtonElement>(".summary-actions button")];
        const ticket = buttons.find((b) => b.textContent!.includes("Ticket"))!;
        const print = buttons.find((b) => b.textContent!.includes("Imprimer"))!;

        expect(ticket.disabled).toBe(true);
        expect(print.disabled).toBe(true);
        expect(el.textContent).toContain("l'impression est bloquée");
    });

    it("should print the receipt", async () => {
        await render();
        const print = vi.spyOn(window, "print").mockImplementation(() => {});

        [...el.querySelectorAll<HTMLButtonElement>(".summary-actions button")]
            .find((button) => button.textContent!.includes("Imprimer"))!
            .click();

        expect(print).toHaveBeenCalled();
        const receipt = el.querySelector(".receipt")!.textContent!;
        expect(receipt).toContain("Ticket n° AB-000006");
        expect(receipt).toContain("Grand marché");
        expect(receipt).toContain("IFU IFU123");
        expect(receipt).toContain("Ni repris ni échangé.");
    });

    it("should open the movement detail when a stock movement is clicked", async () => {
        await render();

        el.querySelector<HTMLButtonElement>(".timeline .move")!.click();
        await fixture.whenStable();

        const detail = el.querySelector("app-movement-detail")!.textContent!;
        expect(detail).toContain("Mouvement n° 30");
        expect(detail).toContain("en stock");
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it("should hide the quantity line when a single unit was sold without discount", async () => {
        await render();

        const riz = [...el.querySelectorAll(".items li")].find((li) =>
            li.textContent!.includes("Riz"),
        )!;
        expect(riz.querySelector("small")).toBeNull();
    });

    it("should show the cash received and the change", async () => {
        await render();

        const payment = el.querySelector(".payment")!.textContent!.replace(/\s+/g, "");
        expect(payment).toContain("Espècesreçues15000F");
        expect(payment).toContain("Monnaierendue4000F");
        const receipt = el.querySelector(".receipt")!.textContent!;
        expect(receipt).toContain("Monnaie rendue");
    });

    it("should show a mobile money payment and say the refund is outside the cash drawer", async () => {
        await render({
            sale: detail({
                payment_method: "MOBILE_MONEY",
                amount_received: null,
            }),
        });

        expect(el.querySelector(".payment")!.textContent).toContain("Mobile money");
        expect(el.querySelector(".receipt")!.textContent).toContain("Payé par mobile money");
        expect(el.querySelector(".confirm")!.textContent).toContain("hors");
    });

    it("should list every payment on the ticket and no negative change", async () => {
        const pay = (id: number, amount: number, received: number | null, method = "CASH") => ({
            id,
            amount,
            payment_method: method,
            amount_received: received,
            user_name: null,
            created_at: "2026-11-12T12:23:00",
        });
        await render({
            sale: detail({
                total: 1500,
                paid_amount: 1500,
                payment_method: "CASH",
                amount_received: 1000,
                payments: [pay(1, 1000, 1000), pay(2, 500, 1000, "MOBILE_MONEY")] as never,
            }),
        });

        const receipt = el.querySelector(".receipt")!.textContent!.replace(/\s+/g, " ");
        expect(receipt.match(/Payé/g)).toHaveLength(2);
        expect(receipt).toContain("Reste à payer");
        expect(receipt).not.toContain("Monnaie rendue");
    });

    it("should show the date of each payment on the page and on the ticket", async () => {
        const pay = (id: number, created_at: string) => ({
            id,
            amount: 500,
            payment_method: "CASH",
            amount_received: 500,
            user_name: null,
            created_at,
        });
        await render({
            sale: detail({
                total: 1000,
                paid_amount: 1000,
                created_at: "2026-11-12T12:00:00",
                payments: [pay(1, "2026-11-12T12:05:00"), pay(2, "2026-11-14T09:00:00")] as never,
            }),
        });

        const receipt = el.querySelector(".receipt")!.textContent!.replace(/\s+/g, " ");
        expect(receipt).toContain("12/11 Payé");
        expect(receipt).toContain("14/11 Payé");

        const page = el.querySelector(".payment")!.textContent!.replace(/\s+/g, " ");
        expect(page).toContain("12 Nov, 12:05 · Espèces");
        expect(page).toContain("14 Nov, 09:00 · Espèces");
    });

    it("should count an old cash sale without amount as exact change", async () => {
        await render({ sale: detail({ amount_received: null }) });

        const payment = el.querySelector(".payment")!.textContent!.replace(/\s+/g, "");
        expect(payment).toContain("Monnaierendue0F");
        expect(el.querySelector(".receipt")!.textContent).toContain("Espèces reçues");
    });

    it("should open the ticket preview with the shop information", async () => {
        await render();

        [...el.querySelectorAll<HTMLButtonElement>(".summary-actions button")]
            .find((button) => button.textContent!.includes("Ticket"))!
            .click();
        await fixture.whenStable();

        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        const preview = el.querySelector(".ticket-dialog app-sale-receipt")!.textContent!;
        expect(preview).toContain("Ticket n° AB-000006");
        expect(preview).toContain("Grand marché");
    });
});

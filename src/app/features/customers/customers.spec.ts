import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { Customers } from "./customers";
import { AuthService } from "../../core/auth/auth.service";
import { Customer } from "../../core/customers/customer.model";
import { CustomerService } from "../../core/customers/customer.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const awa: Customer = {
    id: 4,
    name: "Awa Kouba",
    phone: "06 123 45 67",
    note: null,
    is_active: true,
    created_at: "2026-11-01T10:00:00Z",
    purchases_count: 3,
    total_spent: 45000,
    due_amount: 6500,
    last_purchase_at: "2026-11-13T10:30:00Z",
    oldest_due_at: "2026-11-10T10:30:00Z",
};

const jean: Customer = {
    ...awa,
    id: 5,
    name: "Jean Okemba",
    phone: null,
    purchases_count: 0,
    total_spent: 0,
    due_amount: 0,
    last_purchase_at: null,
};

describe("Customers", () => {
    let fixture: ComponentFixture<Customers>;
    let el: HTMLElement;
    let getCustomers: ReturnType<typeof vi.fn>;

    async function render({ admin = true, rows = [awa, jean], dueTotal = 0 } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        getCustomers = vi.fn(() =>
            of({ rows, total: rows.length, due_total: dueTotal, page: 1, limit: 20 }),
        );

        await TestBed.configureTestingModule({
            imports: [Customers],
            providers: [
                provideRouter([]),
                { provide: CustomerService, useValue: { getCustomers } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(admin),
                        isOwner: signal(false),
                        user: signal({ id: 1, role: admin ? "admin" : "manager" }),
                    },
                },
                {
                    provide: ShopSettingsService,
                    useValue: { shopName: signal("Chez Awa"), defaultCountryCode: signal("242") },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Customers);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should list the customers with their total and what they owe", async () => {
        await render();

        expect(el.querySelectorAll(".row").length).toBe(2);
        expect(text()).toContain("Awa Kouba");
        expect(text()).toContain("3 achats");
        expect(text()).toContain("45 000 F");
        expect(text()).toContain("6 500 F");
        // le numéro reste dans la fiche, pas sur les lignes de la liste
        expect(text()).not.toContain("123 45 67");
    });

    it("should ask only the customers who owe when the chip is pressed", async () => {
        await render();
        el.querySelector<HTMLButtonElement>(".due-chip")!.click();
        await fixture.whenStable();

        expect(getCustomers).toHaveBeenCalledWith(expect.objectContaining({ unpaid: true }));
    });

    it("should make each row a real link to the customer sheet", async () => {
        await render();
        const row = el.querySelector<HTMLAnchorElement>("a.row")!;

        expect(row.getAttribute("href")).toBe("/customers/4");
    });

    it("should offer the inactive view only to the admin", async () => {
        await render({ admin: false });
        expect(text()).not.toContain("Supprimés");
    });

    it("should show a welcoming empty state without customers", async () => {
        await render({ rows: [] });

        expect(text()).toContain("Pas encore de client");
        expect(text()).toContain("Nouveau client");
    });

    async function pressDueChip() {
        el.querySelector<HTMLButtonElement>(".due-chip")!.click();
        await fixture.whenStable();
    }

    it("should sort by the biggest balances when the chip is pressed", async () => {
        await render();
        await pressDueChip();

        expect(getCustomers).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: true, sort: "due" }),
        );
    });

    it("should go back to recent sort when leaving the filter", async () => {
        await render();
        await pressDueChip();
        fixture.componentInstance.selectUnpaid(false);
        await fixture.whenStable();

        expect(getCustomers).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: false, sort: "recent" }),
        );
    });

    it("should not show the automatic sort as an active filter", async () => {
        await render();
        await pressDueChip();
        expect(fixture.componentInstance.activeFilters()).toEqual([]);

        fixture.componentInstance.selectSort("name");
        expect(fixture.componentInstance.activeFilters().length).toBe(1);
    });

    it("should keep a sort chosen by the user when the filter changes", async () => {
        await render();
        fixture.componentInstance.selectSort("name");
        fixture.componentInstance.selectUnpaid(true);
        fixture.componentInstance.selectUnpaid(false);
        await fixture.whenStable();

        expect(fixture.componentInstance.sort()).toBe("name");
    });

    it("should show the amount to collect only with the filter", async () => {
        await render({ dueTotal: 125000 });
        expect(text()).not.toContain("À récupérer");

        await pressDueChip();

        expect(text()).toContain("À récupérer");
        expect(text()).toContain("125 000 F");
        expect(text()).toContain("chez 2 clients");
    });

    it("should offer the WhatsApp icon only with the filter", async () => {
        await render();
        expect(el.querySelector(".wa-chip")).toBeNull();

        await pressDueChip();
        const link = el.querySelector<HTMLAnchorElement>("a.wa-chip")!;

        expect(el.querySelector(".remind-bar")).toBeNull();
        expect(link.getAttribute("href")).toContain("wa.me");
        expect(link.getAttribute("href")).toContain("Awa");
        expect(link.getAttribute("aria-label")).toBe("Relancer Awa Kouba sur WhatsApp");
    });

    it("should disable the icon when the customer has no number", async () => {
        await render({
            rows: [{ ...jean, due_amount: 3000 }],
            dueTotal: 3000,
        });
        await pressDueChip();
        const chip = el.querySelector<HTMLElement>(".wa-chip")!;

        expect(chip.tagName).toBe("SPAN");
        expect(chip.classList).toContain("disabled");
        expect(chip.getAttribute("title")).toBe("Ajoutez son numéro pour le relancer");
        expect(el.querySelector("a.wa-chip")).toBeNull();
    });

    it("should show only the debt, without total or label, in the debts view", async () => {
        await render({ rows: [awa] });
        expect(el.querySelector(".spent")).not.toBeNull();
        expect(el.querySelector(".badge.due")).not.toBeNull();

        await pressDueChip();

        expect(el.querySelector(".spent")).toBeNull();
        expect(el.querySelector(".head-spent")).toBeNull();
        expect(el.querySelector(".due-amount")!.textContent!.replace(/\s/g, " ")).toContain(
            "6 500 F",
        );
        expect(el.querySelector(".row")!.textContent).not.toContain("45 000");
        expect(el.querySelector(".row")!.textContent).not.toContain("Dette");
    });

    it("should say since when the debt exists", async () => {
        await render({
            rows: [
                { ...awa, oldest_due_at: new Date(Date.now() - 3 * 86400000).toISOString() },
                { ...awa, id: 6, oldest_due_at: new Date(Date.now() - 86400000).toISOString() },
                { ...awa, id: 7, oldest_due_at: new Date().toISOString() },
            ],
        });
        await pressDueChip();

        expect(text()).toContain("depuis 3 jours");
        expect(text()).toContain("depuis 1 jour ");
        expect(text()).toContain("depuis aujourd'hui");
        expect(el.querySelector(".head-last")!.textContent).toContain("Depuis");
    });

    it("should keep the sorting inside the filter, without extra chips on the page", async () => {
        await render();
        await pressDueChip();
        expect(el.querySelector(".sort-bar")).toBeNull();

        fixture.componentInstance.selectSort("oldest_due");
        await fixture.whenStable();

        expect(getCustomers).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: true, sort: "oldest_due" }),
        );
    });

    it("should color the avatar orange only for customers who owe", async () => {
        await render();
        const avatars = el.querySelectorAll(".avatar");

        expect(avatars[0].classList).toContain("owes");
        expect(avatars[1].classList).not.toContain("owes");
    });
});

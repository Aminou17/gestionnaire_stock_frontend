import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { CustomerPage } from "./customer-page";
import { AuthService } from "../../../core/auth/auth.service";
import { Customer, CustomerSale } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

const awa: Customer = {
    id: 4,
    name: "Awa Kouba",
    phone: "06 123 45 67",
    note: "Passe le samedi",
    is_active: true,
    created_at: "2026-11-01T10:00:00Z",
    purchases_count: 2,
    total_spent: 13000,
    due_amount: 6500,
    last_purchase_at: "2026-11-13T10:30:00Z",
};

const sale = (id: number, changes: Partial<CustomerSale> = {}): CustomerSale => ({
    id,
    number: id,
    created_at: "2026-11-13T10:30:00Z",
    status: "ACTIVE",
    total: 11500,
    paid_amount: 5000,
    returned_amount: 0,
    payment_method: "CASH",
    user_name: "Awa",
    items_count: 3,
    ...changes,
});

describe("CustomerPage", () => {
    let fixture: ComponentFixture<CustomerPage>;
    let el: HTMLElement;
    let params: BehaviorSubject<Map<string, string>>;
    let getCustomerSales: ReturnType<typeof vi.fn>;

    async function render({
        customer = awa,
        admin = true,
        sales = [sale(24), sale(14, { paid_amount: 11500, created_at: "2026-10-02T10:00:00Z" })],
        total = 0,
    } = {}) {
        params = new BehaviorSubject(new Map([["id", "4"]]));
        getCustomerSales = vi.fn(() =>
            of({ rows: sales, total: Math.max(sales.length, total), page: 1, limit: 10 }),
        );
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        await TestBed.configureTestingModule({
            imports: [CustomerPage],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { paramMap: params } },
                {
                    provide: CustomerService,
                    useValue: {
                        getCustomer: vi.fn(() => of(customer)),
                        getCustomerSales,
                    },
                },
                {
                    provide: ShopSettingsService,
                    useValue: { shopName: signal("Awa Bazin"), defaultCountryCode: signal("242") },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(admin),
                        isOwner: signal(false),
                        user: signal({ id: 1, role: admin ? "admin" : "manager" }),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CustomerPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should show the summary and group the purchases by month", async () => {
        await render();

        expect(text()).toContain("13 000 F");
        expect(text()).toContain("Total dépensé");
        expect(el.querySelectorAll(".month").length).toBe(2);
        expect(text()).toContain("Vente #24");
        expect(text()).toContain("Reste 6 500 F");
    });

    it("should offer a WhatsApp reminder with the message when something is due", async () => {
        await render();
        const link = el.querySelector<HTMLAnchorElement>(".remind")!;

        expect(link.textContent).toContain("Relancer sur WhatsApp");
        expect(link.href).toContain("https://wa.me/242061234567?text=");
        expect(decodeURIComponent(link.href)).toContain("6 500 F");
    });

    it("should not show the reminder when nothing is due", async () => {
        await render({ customer: { ...awa, due_amount: 0 } });

        expect(el.querySelector(".due-card")).toBeNull();
    });

    it("should let only the admin deactivate", async () => {
        await render({ admin: false });
        expect(text()).not.toContain("Supprimer ce client");
    });

    it("should not offer to delete a customer who still owes money", async () => {
        await render();

        expect(el.querySelector("button.danger")).toBeNull();
        expect(el.textContent!.replace(/\s+/g, " ")).toContain("il ne peut pas être supprimé");
    });

    it("should offer to delete a customer who owes nothing", async () => {
        await render({ customer: { ...awa, due_amount: 0 } });

        expect(el.querySelector("button.danger")?.textContent).toContain("Supprimer ce client");
    });

    it("should mark a refunded sale", async () => {
        await render({ sales: [sale(30, { status: "CANCELLED" })] });
        expect(text()).toContain("Remboursée");
    });

    it("should start again at page 1 with the new sales when the customer changes", async () => {
        await render({ total: 30 });
        el.querySelector<HTMLButtonElement>("app-pagination .next")!.click();
        await fixture.whenStable();
        expect(fixture.componentInstance.salesPage()).toBe(2);
        expect(getCustomerSales).toHaveBeenLastCalledWith(4, 2, 10);

        getCustomerSales.mockImplementation((id: number) =>
            of({ rows: [sale(90 + id)], total: 1, page: 1, limit: 20 }),
        );
        params.next(new Map([["id", "9"]]));
        await fixture.whenStable();

        expect(fixture.componentInstance.salesPage()).toBe(1);
        expect(getCustomerSales).toHaveBeenLastCalledWith(9, 1, 10);
        expect(text()).toContain("Vente #99");
        expect(text()).not.toContain("Vente #24");
    });
});

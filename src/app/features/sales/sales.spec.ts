import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { Sales } from "./sales";
import { AuthService } from "../../core/auth/auth.service";
import { Sale, SaleFilters } from "../../core/sales/sale.model";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const sale = (id: number, status: Sale["status"] = "ACTIVE"): Sale => ({
    id,
    user_id: 6,
    user_name: "Awa K.",
    user_role: "manager",
    total: 3000,
    paid_amount: 3000,
    status,
    items_count: 2,
    created_at: "2026-11-02T10:15:00",
    cancelled_at: null,
});

describe("Sales", () => {
    let fixture: ComponentFixture<Sales>;
    let el: HTMLElement;
    let getSalesPage: ReturnType<typeof vi.fn>;

    async function render(isAdmin = true, sales = [sale(6), sale(5, "CANCELLED")]) {
        getSalesPage = vi.fn((filters: SaleFilters) =>
            of({
                data: sales,
                total: sales.length,
                counters: { all: 2, active: 1, cancelled: 1, active_total: 3000 },
                filters,
            }),
        );
        globalThis.IntersectionObserver = class {
            observe() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;

        await TestBed.configureTestingModule({
            imports: [Sales],
            providers: [
                provideRouter([]),
                { provide: SaleService, useValue: { getSalesPage } },
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
                        roleLabel: signal(isAdmin ? "Propriétaire" : "Gérant"),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Sales);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should show the counters and the sales with their status", async () => {
        await render();

        expect(text()).toContain("Toutes les ventes");
        expect(text()).toContain("3 000 F");
        expect(el.querySelectorAll("tbody tr").length).toBe(2);
        // une vente normale n'a pas de badge, seul le remboursement est signalé
        expect(text()).not.toContain("Validée");
        expect(el.querySelectorAll("tbody .badge").length).toBe(1);
        expect(text()).toContain("Remboursée");
        expect(text()).toContain("Vendeur");
        expect(text()).toContain("Awa K.");
    });

    it("should hide the seller column from the manager", async () => {
        await render(false);
        expect(el.querySelector("thead")?.textContent).not.toContain("Vendeur");
    });

    it("should filter by status from page 1", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".stat")[2].click();
        await fixture.whenStable();

        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: "CANCELLED", page: 1 }),
        );
    });

    it("should ask only for unpaid sales from the 'À solder' card", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".stat")[1].click();
        await fixture.whenStable();

        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: true, status: null, page: 1 }),
        );
    });

    it("should show the remaining amount of a sale with a deposit", async () => {
        await render(true, [{ ...sale(7), paid_amount: 1000 }]);
        expect(text()).toContain("Reste");
    });

    it("should send today's dates when the period is today", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".period select")!;
        select.value = "today";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(filters.from).toBe(filters.to);
    });

    it("should send the payment method chosen in the filter", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".filter select")!;
        select.value = "MOBILE_MONEY";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.paymentMethod).toBe("MOBILE_MONEY");
        expect(filters.page).toBe(1);
    });

    it("should send the search text after a short delay", async () => {
        await render();
        const input = el.querySelector<HTMLInputElement>(".search input")!;
        input.value = "#12";
        input.dispatchEvent(new Event("input"));
        await new Promise((resolve) => setTimeout(resolve, 350));
        await fixture.whenStable();

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.search).toBe("#12");
    });

    it("should offer the export to an admin only", async () => {
        await render();
        expect(el.querySelector(".export")).not.toBeNull();
        TestBed.resetTestingModule();
        await render(false);
        expect(el.querySelector(".export")).toBeNull();
    });

    it("should not offer the seller filter to a manager", async () => {
        await render(false);
        expect(el.querySelectorAll(".filter").length).toBe(1);
    });

    it("should invite to make a sale when there is none", async () => {
        await render(true, []);
        expect(text()).toContain("Aucune vente enregistrée pour le moment.");
    });

    it("should show a second row of dates for a custom period, prefilled with the last 7 days", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".period select")!;
        select.value = "custom";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        const dates = el.querySelectorAll<HTMLInputElement>(".custom-range input[type='date']");
        expect(dates.length).toBe(2);
        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).toBe(dates[0].value);
        expect(filters.to).toBe(dates[1].value);
    });

    it("should not reload the list when the custom period is invalid", async () => {
        await render();
        const select = el.querySelector<HTMLSelectElement>(".period select")!;
        select.value = "custom";
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        const calls = getSalesPage.mock.calls.length;

        const [from, to] = el.querySelectorAll<HTMLInputElement>(".custom-range input");
        from.value = "2026-11-10";
        to.value = "2026-11-01";
        to.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        expect(text()).toContain("La date de début doit précéder la date de fin.");
        expect(getSalesPage.mock.calls.length).toBe(calls);

        to.value = "2026-11-10";
        to.dispatchEvent(new Event("change"));
        await fixture.whenStable();

        expect(el.querySelector(".range-error")).toBeNull();
        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ from: "2026-11-10", to: "2026-11-10", page: 1 }),
        );
    });
});

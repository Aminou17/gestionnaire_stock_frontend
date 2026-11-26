import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { Router, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { Sales } from "./sales";
import { AuthService } from "../../core/auth/auth.service";
import { Sale, SaleFilters } from "../../core/sales/sale.model";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const sale = (id: number, status: Sale["status"] = "ACTIVE"): Sale => ({
    id,
    number: id + 100,
    user_id: 6,
    user_name: "Adam K.",
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

    async function render(
        isAdmin = true,
        sales = [sale(6), sale(5, "CANCELLED")],
        total = sales.length,
        url = "/",
    ) {
        getSalesPage = vi.fn((filters: SaleFilters) =>
            of({
                data: sales,
                total,
                counters: {
                    all: 5,
                    active: 4,
                    cancelled: 1,
                    active_total: 3000,
                    unpaid: 2,
                    due_total: 7500,
                    cancelled_total: 1200,
                },
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
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Yabre M.",
                            email: "y@test.com",
                            role: isAdmin ? "admin" : "manager",
                        }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        // Filtre passé dans l'adresse (lien d'une carte du tableau de bord)
        await TestBed.inject(Router).navigateByUrl(url);
        fixture = TestBed.createComponent(Sales);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should list the sales of the day with their status", async () => {
        await render();

        expect(text()).toContain("Toutes");
        expect(text()).toContain("3 000 F");
        expect(el.querySelectorAll(".sale-row").length).toBe(2);
        // Une vente normale n'a pas de badge, seul le remboursement est signalé
        expect(el.querySelectorAll(".sale-row .badge").length).toBe(1);
        expect(text()).toContain("Remboursée");
        // La liste est la même sur ordinateur et sur téléphone
        expect(el.querySelector("table")).toBeNull();
        expect(el.querySelector(".stats")).toBeNull();
    });

    it("should keep each row light: no seller and no item count, the sheet has them", async () => {
        await render();
        const row = el.querySelector(".sale-row")!.textContent!;

        expect(row).not.toContain("Adam K.");
        expect(row).not.toMatch(/article/);
    });

    it("should start on today's sales", async () => {
        await render();

        const filters = getSalesPage.mock.calls[0][0] as SaleFilters;
        expect(filters.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(filters.from).toBe(filters.to);
    });

    it("should not limit the unpaid sales to today", async () => {
        await render(true, undefined, undefined, "/?filter=unpaid");

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.unpaid).toBe(true);
        expect(filters.from).toBeNull();
    });

    const chooseStatus = (index: number) => {
        const select = el.querySelector<HTMLSelectElement>(
            'select[aria-label="Filtrer les ventes"]',
        )!;
        select.value = String(index);
        select.dispatchEvent(new Event("change"));
    };

    it("should filter by status from page 1", async () => {
        await render();
        chooseStatus(2);
        await fixture.whenStable();

        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: "CANCELLED", page: 1 }),
        );
    });

    it("should page through the sales and return to page 1 when a filter changes", async () => {
        await render(true, [sale(6)], 80);
        expect(text()).toContain("1 à 25 sur 80");

        el.querySelector<HTMLButtonElement>("app-pagination .next")!.click();
        await fixture.whenStable();
        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2, limit: 25 }),
        );

        chooseStatus(2);
        await fixture.whenStable();
        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: "CANCELLED", page: 1 }),
        );
    });

    it("should ask only for unpaid sales from the 'À solder' card", async () => {
        await render();
        chooseStatus(1);
        await fixture.whenStable();

        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: true, status: null, page: 1 }),
        );
    });

    it("should open on the unpaid sales of today when the link asks for it", async () => {
        await render(true, undefined, undefined, "/?filter=unpaid&period=today");

        expect(getSalesPage).toHaveBeenLastCalledWith(
            expect.objectContaining({ unpaid: true, status: null }),
        );
        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).not.toBeNull();
        expect(filters.from).toBe(filters.to);
    });

    it("should show the remaining amount of a sale with a deposit", async () => {
        await render(true, [{ ...sale(7), paid_amount: 1000 }]);
        expect(text()).toContain("Reste");
    });

    // Les filtres sont toujours visibles : plus de panneau à ouvrir
    const open = async () => {
        await fixture.whenStable();
    };

    const pick = async (label: string) => {
        const select = el.querySelector<HTMLSelectElement>('select[aria-label="Période"]')!;
        const index = [...select.options].findIndex((o) => o.textContent!.trim() === label);
        select.value = select.options[index].value;
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();
    };

    it("should send today's dates when the period is today", async () => {
        await render();
        await open();
        await pick("Aujourd'hui");

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(filters.from).toBe(filters.to);
        // C'est le réglage de départ : pas de pastille de filtre en plus
        expect(el.querySelector(".active-chip")).toBeNull();
    });

    it("should start the month on the first day", async () => {
        await render();
        await open();
        await pick("Ce mois");

        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).toMatch(/-01$/);
    });

    it("should follow the chip in the summary card", async () => {
        await render();
        const summary = () => ({
            textContent: el.querySelector(".summary")!.textContent!.replace(/\s/g, " "),
            getAttribute: (name: string) => el.querySelector(".summary")!.getAttribute(name),
        });
        expect(summary().getAttribute("data-tone")).toBe("success");
        expect(summary().textContent).toContain("Encaissé");
        expect(summary().textContent).toContain("3 000 F");

        chooseStatus(1);
        await fixture.whenStable();
        expect(summary().getAttribute("data-tone")).toBe("warning");
        expect(summary().textContent).toContain("Reste à encaisser");
        expect(summary().textContent).toContain("7 500 F");
        expect(summary().textContent).toContain("2 ventes");

        chooseStatus(2);
        await fixture.whenStable();
        expect(summary().getAttribute("data-tone")).toBe("danger");
        expect(summary().textContent).toContain("Remboursé");
        expect(summary().textContent).toContain("1 200 F");
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
        expect(el.querySelector("app-export-menu")).not.toBeNull();
        TestBed.resetTestingModule();
        await render(false);
        expect(el.querySelector("app-export-menu")).toBeNull();
    });

    it("should not offer the seller filter to a manager", async () => {
        await render(false);
        expect(el.querySelector("[aria-label='Vendeur']")).toBeNull();
    });

    it("should invite to make a sale when there is none", async () => {
        await render(true, []);
        expect(text()).toContain("Aucune vente aujourd'hui");
        expect(el.querySelector("app-empty-state a")!.getAttribute("href")).toBe("/sales/new");
    });

    it("should prefill a custom period with the last 7 days", async () => {
        await render();
        await open();
        await pick("Dates");

        const dates = el.querySelectorAll<HTMLInputElement>(".custom-range input[type='date']");
        expect(dates.length).toBe(2);
        const filters = getSalesPage.mock.lastCall![0] as SaleFilters;
        expect(filters.from).toBe(dates[0].value);
        expect(filters.to).toBe(dates[1].value);
    });

    it("should not reload the list when the custom period is invalid", async () => {
        await render();
        await open();
        await pick("Dates");
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

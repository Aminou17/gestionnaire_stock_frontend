import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";
import { of, throwError } from "rxjs";

import { Dashboard } from "./dashboard";
import { DashboardService } from "./dashboard.service";
import { DailySales, DashboardSummary } from "./dashboard.model";
import { AuthService } from "../../core/auth/auth.service";
import { SaleService } from "../../core/sales/sale.service";
import { LowStockAlert } from "../../core/stock/low-stock-alert.model";
import { SecurityAlertService } from "../../core/audit/security-alert.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const day = (date: string, netTotal: number, salesCount = 1): DailySales => ({
    date,
    salesTotal: netTotal,
    salesCount,
    cancellationsTotal: 0,
    cancellationsCount: 0,
    netTotal,
});

const openCash: DashboardSummary["cash"] = {
    id: 1,
    status: "OPEN",
    openingAmount: 50000,
    balance: 312000,
    openedAt: "2026-11-11T08:05:00",
    openedByName: "Admin",
    closedAt: null,
};

describe("Dashboard", () => {
    let fixture: ComponentFixture<Dashboard>;
    let el: HTMLElement;

    async function render({
        isAdmin = true,
        cash = openCash,
        days = [day("2026-11-10", 200000), day("2026-11-11", 214000)],
        summaryFails = false,
        yesterdayUntilNow = 200000,
        alerts = [],
        previousOpenSession = null,
        pendingExplanation = null,
    }: {
        isAdmin?: boolean;
        cash?: DashboardSummary["cash"];
        days?: DailySales[];
        summaryFails?: boolean;
        yesterdayUntilNow?: number;
        alerts?: LowStockAlert[];
        previousOpenSession?: DashboardSummary["previousOpenSession"];
        pendingExplanation?: DashboardSummary["pendingExplanation"];
    } = {}) {
        const summary: DashboardSummary = {
            cash,
            previousOpenSession,
            pendingExplanation,
            blindClose: false,
            stockValue: isAdmin ? 4860000 : null,
            activeProducts: isAdmin ? 142 : null,
            lowStockCount: isAdmin ? 5 : null,
        };

        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: DashboardService,
                    useValue: {
                        getSummary: () =>
                            summaryFails ? throwError(() => new Error("500")) : of(summary),
                        getDailySales: () => of(days),
                        getSalesComparison: () =>
                            of({
                                todayTotal: days.at(-1)?.netTotal ?? 0,
                                yesterdayUntilNowTotal: yesterdayUntilNow,
                            }),
                        getRecentActivity: () => of([]),
                    },
                },
                { provide: SaleService, useValue: { getSales: () => of([]) } },
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
                {
                    provide: SecurityAlertService,
                    useValue: { count: signal(0), latest: signal([]), reload: vi.fn() },
                },
                {
                    provide: LowStockAlertService,
                    useValue: {
                        alerts: {
                            value: signal(alerts),
                            hasValue: () => true,
                            isLoading: signal(false),
                            error: signal(undefined),
                            reload: () => {},
                        },
                        count: signal(0),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Dashboard);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");

    it("should show the stock cards to the admin", async () => {
        await render();

        expect(text()).toContain("Produits en alerte");
        expect(text()).toContain("4 860 000 F");
        expect(text()).toContain("142 produits actifs");
        expect(text()).not.toContain("Panier moyen");
    });

    it("should split the alerts between out of stock and low stock", async () => {
        await render({
            alerts: [
                { id: 1, name: "Produit Test", theoretical_stock: 0, min_stock: 10 },
                { id: 2, name: "Clavier USB", theoretical_stock: 0, min_stock: 10 },
                { id: 3, name: "Savon", theoretical_stock: 5, min_stock: 5 },
            ],
        });

        expect(text()).toContain("2 en rupture · 1 en stock faible");
    });

    it("should compare today with yesterday", async () => {
        await render();
        expect(text()).toContain("+7 % vs hier à cette heure");
    });

    it("should not compute a percentage when there was no sale yesterday", async () => {
        await render({
            days: [day("2026-11-10", 0, 0), day("2026-11-11", 5000)],
            yesterdayUntilNow: 0,
        });
        expect(text()).toContain("Aucune vente hier à cette heure");
    });

    it("should show the cash balance when the session is open", async () => {
        await render();

        expect(text()).toContain("312 000 F");
        expect(text()).toContain("Session ouverte à 08:05");
        expect(el.querySelector(".new-sale")?.classList).not.toContain("disabled");
    });

    it("should disable new sales and offer to open the cash register when it is closed", async () => {
        await render({ cash: null });

        expect(text()).toContain("Caisse fermée");
        expect(el.querySelector(".new-sale")?.classList).toContain("disabled");
        expect(el.querySelector(".open-cash")?.textContent).toContain("Ouvrir la caisse");
    });

    it("should keep only the last 7 days for the chart", async () => {
        const month = Array.from({ length: 30 }, (_, i) =>
            day(`2026-10-${String(i + 1).padStart(2, "0")}`, 1000 * (i + 1)),
        );
        await render({ days: month });

        expect(el.querySelectorAll("app-sales-chart .bar").length).toBe(7);
        expect(text()).toContain("30 000 F");
    });

    it("should show an error instead of fake values when the summary fails", async () => {
        await render({ summaryFails: true });

        expect(el.querySelector(".alert-error")?.textContent).toContain(
            "n'ont pas pu être chargées",
        );
        expect(text()).not.toContain("Caisse fermée");
        expect(text()).toContain("Données indisponibles");
        expect(el.querySelector(".open-cash")).toBeNull();
    });

    it("should not show the manager any admin block", async () => {
        await render({ isAdmin: false });

        expect(text()).not.toContain("Valeur du stock");
        expect(text()).not.toContain("Produits en alerte");
        expect(text()).not.toContain("Alertes de stock");
        expect(text()).not.toContain("null");
        expect(el.querySelector("app-stock-alerts")).toBeNull();
        expect(el.querySelector(".open-cash")).toBeNull();
    });

    it("should show the manager's blocks in the requested order", async () => {
        await render({ isAdmin: false });

        const blocks = [...el.querySelectorAll(".manager > *")].map((b) => b.className);
        expect(blocks).toEqual([
            "m-cash",
            "m-today",
            "m-chart",
            "m-sales",
            "m-activity",
            "m-close",
        ]);
        expect(text()).toContain("Mes ventes du jour");
        expect(text()).toContain("+7 % vs hier à cette heure");
        expect(text()).toContain("Mes ventes sur 7 jours");
        expect(text()).toContain("Mes dernières ventes");
        expect(text()).toContain("Mon activité récente");
    });

    it("should show the manager the open cash register and its balance", async () => {
        await render({ isAdmin: false });

        expect(text()).toContain("Caisse ouverte");
        expect(text()).toContain("312 000 F");
        expect(el.querySelector(".new-sale")?.classList).not.toContain("disabled");
        expect(el.querySelector(".close-cash")?.getAttribute("href")).toBe("/cash");
    });

    it("should ask the manager to call the admin when the cash register is closed", async () => {
        await render({ isAdmin: false, cash: null });

        expect(text()).toContain("Caisse fermée");
        expect(text()).toContain("Demandez au propriétaire de l'ouvrir");
        expect(el.querySelector(".new-sale")?.classList).toContain("disabled");
        expect(el.querySelector(".close-cash")).toBeNull();
        expect(text()).not.toContain("Ouvrir la caisse");
    });

    it("should treat a cash register closed today as closed for the manager", async () => {
        await render({
            isAdmin: false,
            cash: { ...openCash!, status: "CLOSED", closedAt: "2026-11-11T18:00:00" },
        });

        expect(text()).toContain("Caisse fermée");
        expect(el.querySelector(".new-sale")?.classList).toContain("disabled");
        expect(el.querySelector(".close-cash")).toBeNull();
    });

    it("should warn the manager when a previous cash session is still open", async () => {
        await render({
            isAdmin: false,
            previousOpenSession: {
                id: 3,
                sessionDate: "2026-11-10",
                openedAt: "2026-11-10T08:00:00",
                balance: null,
            },
        });

        const alert = el.querySelector(".m-previous");
        expect(alert?.classList).toContain("alert-warning");
        expect(alert?.textContent).toContain("n'a pas été clôturée");
    });

    it("should not show fake cash values to the manager when the summary fails", async () => {
        await render({ isAdmin: false, summaryFails: true });

        expect(text()).toContain("État de la caisse indisponible");
        expect(text()).not.toContain("Caisse fermée");
        expect(text()).not.toContain("Caisse ouverte");
        expect(el.querySelector(".new-sale")?.classList).toContain("disabled");
    });

    it("should ask the manager who closed to explain a pending gap", async () => {
        await render({
            isAdmin: false,
            pendingExplanation: { id: 3, sessionDate: "2026-11-10", difference: -500, closedBy: 1 },
        });

        const alert = el.querySelector(".m-previous");
        expect(alert?.textContent).toContain("Expliquez l'écart");
        expect(alert?.querySelector("a")?.getAttribute("href")).toBe("/cash");
    });

    it("should not bother another manager with someone else's gap", async () => {
        await render({
            isAdmin: false,
            pendingExplanation: {
                id: 3,
                sessionDate: "2026-11-10",
                difference: -500,
                closedBy: 999,
            },
        });

        expect(text()).not.toContain("Expliquez l'écart");
    });

    it("should tell the owner that a gap blocks the next opening", async () => {
        await render({
            pendingExplanation: {
                id: 3,
                sessionDate: "2026-11-10",
                difference: -500,
                closedBy: 999,
            },
        });

        expect(text()).toContain("n'est pas expliqué");
    });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { signal } from "@angular/core";
import { of, throwError } from "rxjs";

import { Dashboard } from "./dashboard";
import { DashboardService } from "./dashboard.service";
import { DailySales, DashboardSummary } from "./dashboard.model";
import { AuthService } from "../../core/auth/auth.service";
import { SecretValues } from "../../shared/secret/secret-values";
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
    actualAmount: null,
    difference: null,
};

const uncounted: DashboardSummary["uncountedSession"] = {
    id: 3,
    sessionDate: "2026-11-10",
    openedAt: "2026-11-10T08:00:00",
    openedBy: 2,
    openedByName: "Awa",
    balance: 25000,
    count: 1,
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
        uncountedSession = null,
        expectedOpening = 12000 as number | null,
        reserved = false,
        sales = [{ id: 1 }] as any[],
    }: {
        isAdmin?: boolean;
        cash?: DashboardSummary["cash"];
        days?: DailySales[];
        summaryFails?: boolean;
        yesterdayUntilNow?: number;
        alerts?: LowStockAlert[];
        uncountedSession?: DashboardSummary["uncountedSession"];
        expectedOpening?: number | null;
        reserved?: boolean;
        sales?: any[];
    } = {}) {
        const summary: DashboardSummary = {
            cash,
            uncountedSession,
            expectedOpening,
            blindClose: false,
            stockValue: isAdmin ? 4860000 : null,
            activeProducts: isAdmin ? 142 : null,
            lowStockCount: isAdmin ? 5 : null,
            todayProfit: isAdmin ? 86000 : null,
            todayMargin: isAdmin ? 40 : null,
        };

        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap(reserved ? { reserved: "1" } : {}),
                        },
                    },
                },
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
                {
                    provide: SaleService,
                    useValue: {
                        getSales: () => of(sales),
                        getSalesPage: () =>
                            of({
                                data: sales,
                                total: sales.length,
                                counters: { unpaid: 2, due_total: 12000 },
                            }),
                    },
                },
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

        expect(text()).toContain("Bénéfice du jour");
        expect(text()).toContain("86 000 F");
        expect(text()).not.toContain("%");
        // la valeur du stock reste masquée tant que le mot de passe n'est pas redonné
        expect(text()).not.toContain("4 860 000 F");
        TestBed.inject(SecretValues).revealed.set(true);
        fixture.detectChanges();
        expect(text()).toContain("4 860 000 F");
        expect(text()).toContain("Valeur du stock");
        expect(text()).not.toContain("Panier moyen");
    });

    it("should tell a manager that the page he tried to open is reserved", async () => {
        await render({ isAdmin: false, reserved: true });

        expect(text()).toContain("Cette page est réservée à l'administrateur");
    });

    it("should not show the reserved notice on a normal visit", async () => {
        await render();

        expect(text()).not.toContain("réservée à l'administrateur");
    });

    it("should split the alerts between out of stock and low stock", async () => {
        await render({
            alerts: [
                {
                    id: 1,
                    name: "Produit Test",
                    theoretical_stock: 0,
                    min_stock: 10,
                    sold_last_30_days: 0,
                    days_left: null,
                    category_id: null,
                    category_name: null,
                    supplier_id: null,
                    supplier_name: null,
                    supplier_contact: null,
                    supplier_phone: null,
                    last_entry_at: null,
                    last_entry_quantity: null,
                    status: "OUT_OF_STOCK",
                    suggested_quantity: 20,
                },
                {
                    id: 2,
                    name: "Clavier USB",
                    theoretical_stock: 0,
                    min_stock: 10,
                    sold_last_30_days: 0,
                    days_left: null,
                    category_id: null,
                    category_name: null,
                    supplier_id: null,
                    supplier_name: null,
                    supplier_contact: null,
                    supplier_phone: null,
                    last_entry_at: null,
                    last_entry_quantity: null,
                    status: "OUT_OF_STOCK",
                    suggested_quantity: 20,
                },
                {
                    id: 3,
                    name: "Savon",
                    theoretical_stock: 5,
                    min_stock: 5,
                    sold_last_30_days: 0,
                    days_left: null,
                    category_id: null,
                    category_name: null,
                    supplier_id: null,
                    supplier_name: null,
                    supplier_contact: null,
                    supplier_phone: null,
                    last_entry_at: null,
                    last_entry_quantity: null,
                    status: "LOW",
                    suggested_quantity: 5,
                },
            ],
        });

        expect(el.querySelector(".todo")).toBeNull();
    });

    it("should guide the owner step by step before the first sale", async () => {
        await render({ sales: [], cash: null });

        const start = el.querySelector(".start");
        expect(start?.textContent).toContain("Pour bien démarrer");
        expect(start?.textContent).toContain("1 sur 2");
        expect(el.querySelector(".todo")).toBeNull();
    });

    it("should hide the first steps once a sale exists", async () => {
        await render();

        expect(el.querySelector(".start")).toBeNull();
    });

    it("should show how much customers still owe", async () => {
        await render();

        expect(text()).toContain("Crédits clients");
        expect(text()).toContain("12 000 F");
        expect(text()).toContain("2 ventes non réglées");
    });

    it("should show the number of sales today without any percentage", async () => {
        await render({
            days: [day("2026-11-10", 0, 0), day("2026-11-11", 5000)],
            yesterdayUntilNow: 0,
        });
        expect(text()).toContain("1 vente");
        expect(text()).not.toContain("%");
    });

    it("should not show minus 100 percent when nothing was sold yet today", async () => {
        await render({
            days: [day("2026-11-10", 200000), day("2026-11-11", 0, 0)],
            yesterdayUntilNow: 50000,
        });
        expect(text()).toContain("Aucune vente");
        expect(text()).not.toContain("100 %");
    });

    it("should draw the week curve in the main card", async () => {
        await render();
        expect(el.querySelector(".hero .spark-line")).not.toBeNull();
    });

    it("should show the cash balance of the shop to the admin", async () => {
        await render();

        expect(text()).toContain("En caisse");
        expect(text()).toContain("312 000 F");
        expect(text()).toContain("Depuis 08:05");
        expect(text()).not.toContain("Caisses du jour");
        expect(text()).not.toContain("Caisse");
        expect(el.querySelector(".view-switch")).toBeNull();
    });

    it("should announce the opening amount when no cash register exists yet", async () => {
        await render({ cash: null, isAdmin: false });

        expect(text()).toContain("La caisse s'ouvrira avec 12 000 F");
        expect(text()).not.toContain("Caisse fermée");
        expect(el.querySelector(".alert")).toBeNull();
    });

    it("should never block anything with an open or reopen button for the owner", async () => {
        await render({ cash: null, isAdmin: false });

        const buttons = [...el.querySelectorAll("button, a")].map((b) => b.textContent!.trim());
        expect(buttons).not.toContain("Ouvrir la caisse");
        expect(buttons).not.toContain("Rouvrir la caisse");
    });

    it("should remind the owner of an uncounted past cash register", async () => {
        await render({ uncountedSession: uncounted });

        const notice = el.querySelector("app-uncounted-cash-notice");
        expect(notice?.textContent).toContain("non comptée");
        expect(notice?.textContent?.replace(/\s/g, "")).toContain("25000F");
        expect(notice?.querySelector("button")?.textContent).toContain("Compter");
    });

    it("should show no reminder when every cash register is counted", async () => {
        await render();

        expect(el.querySelector("app-uncounted-cash-notice")).toBeNull();
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
        expect(text()).not.toContain("Pas ouverte");
        expect(text()).toContain("Données indisponibles");
    });

    it("should not show the manager any admin block", async () => {
        await render({ isAdmin: false });

        expect(text()).not.toContain("Valeur du stock");
        expect(text()).not.toContain("Bénéfice du jour");
        expect(text()).not.toContain("Crédits clients");
        expect(text()).not.toContain("À surveiller");
        expect(text()).not.toContain("null");
        expect(el.querySelector("app-stock-alerts")).toBeNull();
    });

    it("should show the manager a short empty state when there is no sale this week", async () => {
        await render({ isAdmin: false, days: [day("2026-11-10", 0, 0), day("2026-11-11", 0, 0)] });

        expect(el.querySelector(".m-empty")).not.toBeNull();
        expect(el.querySelector(".m-chart")).toBeNull();
        expect(text()).toContain("Pas encore de vente cette semaine");
    });

    it("should show the manager's blocks in the requested order", async () => {
        await render({ isAdmin: false });

        const blocks = [...el.querySelectorAll(".manager > *")].map((b) => b.className);
        expect(blocks).toEqual(["m-cash", "m-today", "m-chart", "m-sales", "m-close"]);
        expect(text()).toContain("Mes ventes du jour");
        expect(text()).not.toContain("vs hier");
        expect(text()).toContain("Mes ventes sur 7 jours");
        expect(text()).toContain("Mes dernières ventes");
        expect(text()).not.toContain("Mon activité récente");
    });

    it("should show the manager the open cash register and its balance", async () => {
        await render({ isAdmin: false });

        expect(text()).toContain("Caisse");
        expect(text()).toContain("312 000 F");
        expect(el.querySelector(".close-cash")?.getAttribute("href")).toBe("/cash");
        expect(el.querySelector(".close-cash")?.textContent).toContain("Compter la caisse");
    });

    it("should let the manager sell right away when no cash register exists yet", async () => {
        await render({ isAdmin: false, cash: null });

        expect(text()).toContain("La caisse s'ouvrira avec 12 000 F");
        expect(el.querySelector(".new-sale")?.getAttribute("href")).toBe("/sales/new");
        expect(text()).not.toContain("Ouvrir la caisse");
        expect(el.querySelector(".close-cash")).toBeNull();
    });

    it("should say the cash opens with the first sale when the opening amount is hidden", async () => {
        await render({ isAdmin: false, cash: null, expectedOpening: null });

        expect(text()).toContain("Elle s'ouvrira à la première vente");
    });

    it("should show a counted cash register to the manager and still let him sell", async () => {
        await render({
            isAdmin: false,
            cash: {
                ...openCash!,
                status: "CLOSED",
                closedAt: "2026-11-11T18:00:00",
                difference: -500,
            },
        });

        expect(text()).toContain("Caisse comptée");
        expect(text()).toContain("Écart −500 F");
        expect(el.querySelector(".new-sale")?.getAttribute("href")).toBe("/sales/new");
        expect(el.querySelector(".close-cash")).toBeNull();
    });

    it("should remind the manager of his uncounted cash register", async () => {
        await render({ isAdmin: false, uncountedSession: uncounted });

        const notice = el.querySelector(".m-previous");
        expect(notice?.tagName.toLowerCase()).toBe("app-uncounted-cash-notice");
        expect(notice?.textContent).toContain("non comptée");
        expect(notice?.querySelector("button")?.textContent).toContain("Compter");
    });

    it("should hide the expected amount from a blind manager", async () => {
        await render({
            isAdmin: false,
            uncountedSession: { ...uncounted, balance: null },
        });

        expect(el.querySelector(".m-previous")?.textContent?.replace(/\s/g, "")).not.toContain(
            "25000F",
        );
    });

    it("should not show fake cash values to the manager when the summary fails", async () => {
        await render({ isAdmin: false, summaryFails: true });

        expect(text()).toContain("État de la caisse indisponible");
        expect(text()).not.toContain("Caisse du jour");
        expect(text()).not.toContain("Caisse");
        expect(el.querySelector(".new-sale")).toBeNull();
    });
    it("should give the manager his sales view and no shop totals", async () => {
        await render({ isAdmin: false });

        expect(text()).toContain("Mes ventes du jour");
        expect(text()).not.toContain("En caisse");
        expect(text()).not.toContain("Crédits clients");
        expect(text()).not.toContain("Mon bénéfice du jour");
    });

    it("should hide the cash amounts from a blind manager", async () => {
        await render({
            isAdmin: false,
            cash: { ...openCash, openingAmount: null, balance: null },
            expectedOpening: null,
        });

        expect(text()).toContain("Caisse");
        expect(text()).not.toContain("312 000 F");
        expect(text()).not.toContain("Solde");
    });
});

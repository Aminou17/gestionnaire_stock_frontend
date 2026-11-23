import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Cash } from "./cash";
import { AuthService } from "../../core/auth/auth.service";
import { CashSessionDetail, CashToday } from "../../core/cash/cash.model";
import { CashSessionService } from "../../core/cash/cash-session.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const openCash: NonNullable<CashToday["cash"]> = {
    id: 4,
    status: "OPEN",
    openingAmount: 5000,
    balance: 9500,
    openedAt: "2026-11-10T08:00:00",
    openedByName: "Yabre M.",
    closedAt: null,
    actualAmount: null,
    difference: null,
};

// la veille, calculée pour que "d'hier" reste vrai quel que soit le jour du test
const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

const uncounted = {
    id: 3,
    sessionDate: yesterday,
    openedAt: `${yesterday}T08:00:00`,
    openedBy: 1,
    openedByName: "Awa",
    balance: 12000,
    count: 1,
};

const detail = (overrides: Partial<CashSessionDetail> = {}): CashSessionDetail => ({
    id: 4,
    session_date: "2026-11-10",
    status: "OPEN",
    opening_amount: 5000,
    theoretical_amount: null,
    actual_amount: null,
    difference: null,
    opened_at: "2026-11-10T08:00:00",
    closed_at: null,
    opened_by: 1,
    opened_by_name: "Yabre M.",
    closed_by_name: null,
    closing_note: null,
    closed_by: null,
    movements: [
        {
            id: 1,
            type: "SALE",
            amount: 4500,
            user_id: 2,
            user_name: "Awa K.",
            reference_type: "sale",
            reference_id: 12,
            sale_number: 112,
            reason_category: null,
            reason: null,
            created_at: "2026-11-10T09:00:00",
        },
    ],
    ...overrides,
});

describe("Cash", () => {
    let fixture: ComponentFixture<Cash>;
    let el: HTMLElement;

    async function render({
        isAdmin = true,
        userId = 1,
        today = {} as Partial<CashToday>,
        session = detail(),
        failToday = false,
    } = {}) {
        const fullToday: CashToday = {
            cash: openCash,
            uncountedSession: null,
            expectedOpening: 9000,
            blindClose: false,
            ...today,
        };

        await TestBed.configureTestingModule({
            imports: [Cash],
            providers: [
                provideRouter([]),
                {
                    provide: CashSessionService,
                    useValue: {
                        getToday: () =>
                            failToday ? throwError(() => new Error("fail")) : of(fullToday),
                        getSession: () => of(session),
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({
                            id: userId,
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

        fixture = TestBed.createComponent(Cash);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, "");
    const buttons = () =>
        [...el.querySelectorAll("button, a.btn")]
            // les boutons des boîtes de dialogue sont toujours dans la page, cachés
            .filter((b) => !b.closest("dialog"))
            .map((b) => b.textContent!.trim());

    function stubDialogs() {
        el.querySelectorAll("dialog").forEach((dialog) => {
            dialog.showModal = function () {
                this.open = true;
            };
            dialog.close = function () {
                this.open = false;
            };
        });
    }

    it("should show the balance and the day's movements when the cash is open", async () => {
        await render();

        expect(text()).toContain("Caissedujour");
        expect(text()).toContain("Depuis08:00·fonds5000FEncours");
        expect(text()).toContain("9500F");
        expect(text()).toContain("Vente#112");
        expect(text()).toContain("Ventes4500F");
        expect(buttons()).toContain("Compter la caisse");
        // plus d'ouverture ni de clôture à faire à la main
        expect(buttons()).not.toContain("Ouvrir la caisse");
        expect(buttons()).not.toContain("Clôturer la caisse");
    });

    it("should show the Mobile Money total apart from the drawer", async () => {
        await render({ session: detail({ mobile_money_total: 42000 }) });

        expect(text()).toContain("MobileMoney,horstiroir42000F");
    });

    it("should not show a Mobile Money line without Mobile Money sales", async () => {
        await render();

        expect(text()).not.toContain("MobileMoney");
    });

    it("should highlight the counting button in the evening", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 10, 20, 0));

        await render();

        const button = [...el.querySelectorAll("button")].find((b) =>
            b.textContent?.includes("Compter la caisse"),
        );
        expect(button?.classList).toContain("late");
        vi.useRealTimers();
    });

    it("should not highlight the counting button during the day", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 10, 11, 0));

        await render();

        expect(el.querySelector(".late")).toBeNull();
        vi.useRealTimers();
    });

    it("should let the owner add, spend and withdraw money", async () => {
        await render();

        const tiles = [...el.querySelectorAll(".quick-tile strong")].map((t) => t.textContent);
        expect(tiles).toEqual(["Ajout", "Dépense", "Retrait"]);
        // la dépense se saisit sur sa propre page
        expect(el.querySelector(".quick-tile[href='/expenses/new']")).not.toBeNull();
    });

    it("should let the manager add, spend and withdraw money from the dialog", async () => {
        await render({ isAdmin: false });

        const tiles = [...el.querySelectorAll(".quick-tile strong")].map((t) => t.textContent);
        expect(tiles).toEqual(["Ajout", "Dépense", "Retrait"]);
        expect(el.querySelector(".quick-tile[href='/expenses/new']")).toBeNull();
    });

    it("should show the history link to the owner only", async () => {
        await render();
        expect(el.querySelector("a[href='/cash/sessions']")).not.toBeNull();
    });

    it("should hide the history link from the manager", async () => {
        await render({ isAdmin: false });
        expect(el.querySelector("a[href='/cash/sessions']")).toBeNull();
    });

    it("should open the counting dialog with the expected balance", async () => {
        await render();
        stubDialogs();
        const dialogs = el.querySelector("app-count-cash-dialog")!;

        [...el.querySelectorAll("button")]
            .find((b) => b.textContent!.trim() === "Compter la caisse")!
            .click();
        await fixture.whenStable();

        expect(dialogs.querySelector("dialog")!.open).toBe(true);
        expect(dialogs.textContent!.replace(/\s/g, "")).toContain("Attendudansletiroir9500F");
    });

    it("should hide the balance and the summary from the manager in blind mode", async () => {
        await render({
            isAdmin: false,
            today: {
                cash: { ...openCash, balance: null, openingAmount: null },
                blindClose: true,
            },
        });
        stubDialogs();

        expect(text()).toContain("Soldemasqué");
        expect(text()).not.toContain("9500F");
        expect(text()).not.toContain("fonds5000F");

        [...el.querySelectorAll("button")]
            .find((b) => b.textContent!.trim() === "Compter la caisse")!
            .click();
        await fixture.whenStable();

        const dialog = el.querySelector("app-count-cash-dialog")!;
        expect(dialog.textContent).not.toContain("Attendu dans le tiroir");
        expect(dialog.textContent).toContain("L'écart vous sera montré après l'enregistrement");
    });

    it("should announce the opening amount while no cash register exists", async () => {
        await render({ today: { cash: null } });

        expect(text()).toContain("Lacaisses'ouvriraavec9000F");
        expect(buttons()).toContain("Nouvelle vente");
        expect(buttons()).not.toContain("Ouvrir la caisse");
    });

    it("should say the cash register opens with the first sale when the amount is hidden", async () => {
        await render({ isAdmin: false, today: { cash: null, expectedOpening: null } });

        expect(text()).toContain("Elles'ouvriraàlapremièrevente");
    });

    it("should remind of an uncounted past cash register without blocking anything", async () => {
        await render({ today: { uncountedSession: uncounted } });

        expect(text()).toContain("Caissed'hiernoncomptée");
        expect(text()).toContain("Attendu12000F");
        expect(buttons()).toContain("Compter");
        // la caisse du jour reste utilisable
        expect(buttons()).toContain("Compter la caisse");
        expect(el.querySelector(".quick-tile")).not.toBeNull();
    });

    it("should open the counting dialog for the uncounted session", async () => {
        await render({ today: { cash: null, uncountedSession: uncounted } });
        stubDialogs();

        el.querySelector<HTMLButtonElement>("app-uncounted-cash-notice button")!.click();
        await fixture.whenStable();

        const dialog = el.querySelector("app-count-cash-dialog")!;
        expect(dialog.querySelector("dialog")!.open).toBe(true);
        expect(dialog.textContent!.replace(/\s/g, "")).toContain("Attendudansletiroir12000F");
    });

    it("should show no reminder once everything is counted", async () => {
        await render();

        expect(el.querySelector("app-uncounted-cash-notice")).toBeNull();
    });

    it("should hide the expected amount of an uncounted session from a blind manager", async () => {
        await render({
            isAdmin: false,
            today: { uncountedSession: { ...uncounted, balance: null } },
        });

        expect(text()).toContain("Caissed'hiernoncomptée");
        expect(text()).not.toContain("12000F");
    });

    it("should show the counted amount, the gap and the reason once counted", async () => {
        await render({
            today: { cash: { ...openCash, status: "CLOSED", closedAt: "2026-11-10T19:00:00" } },
            session: detail({
                status: "CLOSED",
                theoretical_amount: 9500,
                actual_amount: 9000,
                difference: -500,
                closed_at: "2026-11-10T19:00:00",
                closing_note: "Erreur de monnaie",
            }),
        });

        expect(text()).toContain("Comptéeà19:00·fonds5000FComptée");
        expect(text()).toContain("Montantcompté9000F");
        expect(text()).toContain("Écart−500F");
        expect(text()).toContain("Raison:Erreurdemonnaie");
        expect(buttons()).not.toContain("Compter la caisse");
        expect(buttons()).toContain("Rectifier le comptage");
    });

    it("should not let the manager correct a counting", async () => {
        await render({
            isAdmin: false,
            today: { cash: { ...openCash, status: "CLOSED", closedAt: "2026-11-10T19:00:00" } },
            session: detail({ status: "CLOSED", theoretical_amount: 9500, actual_amount: 9000 }),
        });

        expect(buttons()).not.toContain("Rectifier le comptage");
    });

    it("should say who counted the cash register and show who made each movement", async () => {
        await render({
            today: { cash: { ...openCash, status: "CLOSED", closedAt: "2026-11-10T19:00:00" } },
            session: detail({
                status: "CLOSED",
                theoretical_amount: 9500,
                actual_amount: 9000,
                closed_by_name: "Kevin Bakala",
            }),
        });

        expect(text()).toContain("ComptéparKevinBakala");
        expect(text()).not.toContain("Suividescaisses");
        expect(text()).toContain("AwaK.");
    });

    it("should show an error with a retry button instead of a fake closed cash", async () => {
        await render({ failToday: true });

        expect(text()).toContain("Impossibledechargerl'étatdelacaisse.");
        expect(text()).not.toContain("Caissedujour");
        expect(buttons()).toContain("Réessayer");
    });
});

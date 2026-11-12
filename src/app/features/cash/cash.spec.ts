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
    opened_by_name: "Yabre M.",
    closed_by_name: null,
    closing_note: null,
    explanation_pending: false,
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
            previousOpenSession: null,
            pendingExplanation: null,
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
                        user: signal({
                            id: userId,
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

        expect(text()).toContain("Caisseouverte");
        expect(text()).toContain("9500F");
        expect(text()).toContain("Venten°12");
        expect(text()).toContain("Fonddecaisse5000F");
        expect(text()).toContain("Ventesenespèces4500F");
        expect(buttons()).toContain("Nouvelle vente");
        expect(buttons()).toContain("Clôturer la caisse");
    });

    it("should let the owner add, spend and withdraw money", async () => {
        await render();

        expect(buttons()).toEqual(expect.arrayContaining(["Ajouter", "Dépense", "Retrait"]));
    });

    it("should let the manager add money but not take it out", async () => {
        await render({ isAdmin: false });

        expect(buttons()).toContain("Ajouter de l'argent");
        expect(buttons()).not.toContain("Dépense");
        expect(buttons()).not.toContain("Retrait");
        expect(buttons()).toContain("Clôturer la caisse");
    });

    it("should open the closing dialog with the expected balance", async () => {
        await render();
        stubDialogs();
        const dialogs = el.querySelector("app-close-cash-dialog")!;

        [...el.querySelectorAll("button")]
            .find((b) => b.textContent!.trim() === "Clôturer la caisse")!
            .click();
        await fixture.whenStable();

        expect(dialogs.querySelector("dialog")!.open).toBe(true);
        expect(dialogs.textContent!.replace(/\s/g, "")).toContain("Soldeattendu9500F");
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
        expect(text()).not.toContain("Fonddecaisse5000F");

        [...el.querySelectorAll("button")]
            .find((b) => b.textContent!.trim() === "Clôturer la caisse")!
            .click();
        await fixture.whenStable();

        const dialog = el.querySelector("app-close-cash-dialog")!;
        expect(dialog.textContent).not.toContain("Solde attendu");
        expect(dialog.textContent).toContain("L'écart vous sera montré après la clôture");
    });

    it("should offer to open the cash register to the owner when it is closed", async () => {
        await render({ today: { cash: null } });

        expect(text()).toContain("Caissefermée");
        expect(buttons()).toContain("Ouvrir la caisse");
        expect(buttons()).not.toContain("Nouvelle vente");
    });

    it("should ask the manager to call the owner when the cash is closed", async () => {
        await render({ isAdmin: false, today: { cash: null } });

        expect(text()).toContain("Demandezaupropriétaired'ouvrirlacaisse");
        expect(buttons()).not.toContain("Ouvrir la caisse");
    });

    it("should show the counted amount, the gap and its explanation once closed", async () => {
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

        expect(text()).toContain("Caisseclôturée");
        expect(text()).toContain("Montantcompté9000F");
        expect(text()).toContain("Écart−500F");
        expect(text()).toContain("Explication:Erreurdemonnaie");
        expect(buttons()).not.toContain("Clôturer la caisse");
        expect(buttons()).not.toContain("Nouvelle vente");
    });

    it("should warn about a previous cash register that was never closed", async () => {
        await render({
            today: {
                previousOpenSession: {
                    id: 3,
                    sessionDate: "2026-11-09",
                    openedAt: "2026-11-09T08:00:00",
                    balance: 12000,
                },
            },
        });

        expect(el.querySelector('[role="alert"]')?.textContent).toContain("n'a pas été clôturée");
        expect(buttons()).toContain("La clôturer");
    });

    it("should let the person who closed explain a pending gap", async () => {
        await render({
            isAdmin: false,
            userId: 2,
            today: {
                pendingExplanation: {
                    id: 3,
                    sessionDate: "2026-11-09",
                    difference: -500,
                    closedBy: 2,
                },
            },
        });
        stubDialogs();

        expect(text()).toContain("n'estpasexpliqué");
        [...el.querySelectorAll("button")]
            .find((b) => b.textContent!.trim() === "Expliquer l'écart")!
            .click();
        await fixture.whenStable();

        const dialog = el.querySelector("app-close-cash-dialog")!;
        expect(dialog.querySelector("dialog")!.open).toBe(true);
        expect(dialog.textContent!.replace(/\s/g, "")).toContain("Ilmanquait500F");
    });

    it("should not let another manager explain the gap", async () => {
        await render({
            isAdmin: false,
            userId: 5,
            today: {
                pendingExplanation: {
                    id: 3,
                    sessionDate: "2026-11-09",
                    difference: -500,
                    closedBy: 2,
                },
            },
        });

        expect(text()).toContain("Lapersonnequiaclôturédoitl'expliquer.");
        expect(buttons()).not.toContain("Expliquer l'écart");
    });

    it("should show an error with a retry button instead of a fake closed cash", async () => {
        await render({ failToday: true });

        expect(text()).toContain("Impossibledechargerl'étatdelacaisse.");
        expect(text()).not.toContain("Caissefermée");
        expect(buttons()).toContain("Réessayer");
    });
});

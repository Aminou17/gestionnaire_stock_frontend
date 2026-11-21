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
    opened_by: 1,
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
        lastClosed = null as CashSessionDetail | null,
    } = {}) {
        const fullToday: CashToday = {
            cash: openCash,
            previousOpenSession: null,
            pendingExplanation: null,
            teamSessions: null,
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
                        getSessions: () =>
                            of({ data: lastClosed ? [lastClosed] : [], pagination: {} }),
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
        expect(text()).toContain("Depuis08:00·fonds5000FOuverte");
        expect(text()).toContain("9500F");
        expect(text()).toContain("Vente#112");
        expect(text()).toContain("Ventes4500F");
        expect(text()).not.toContain("Ventesenespèces4500F");
        // la vente se lance depuis le menu et la page Ventes, pas d'ici
        expect(buttons()).not.toContain("Nouvelle vente");
        expect(buttons()).toContain("Clôturer la caisse");
    });

    it("should show the Mobile Money total apart from the drawer", async () => {
        await render({ session: detail({ mobile_money_total: 42000 }) });

        expect(text()).toContain("MobileMoney,horstiroir42000F");
    });

    it("should not show a Mobile Money line without Mobile Money sales", async () => {
        await render();

        expect(text()).not.toContain("MobileMoney");
    });

    it("should highlight the closing button in the evening", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 10, 20, 0));

        await render();

        const button = [...el.querySelectorAll("button")].find((b) =>
            b.textContent?.includes("Clôturer la caisse"),
        );
        expect(button?.classList).toContain("late");
        // plus de bandeau en plus
        expect(el.querySelector(".reminder")).toBeNull();
        vi.useRealTimers();
    });

    it("should not highlight the closing button during the day", async () => {
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

    it("should let the manager add money but not take it out", async () => {
        await render({ isAdmin: false });

        const tiles = [...el.querySelectorAll(".quick-tile strong")].map((t) => t.textContent);
        expect(tiles).toEqual(["Ajout"]);
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
        expect(text()).not.toContain("Fondsdedépart5000F");

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

        expect(text()).toContain("Caissenonouverte");
        expect(buttons()).toContain("Ouvrir la caisse");
        expect(buttons()).not.toContain("Nouvelle vente");
    });

    it("should block the opening while the previous cash register is still open", async () => {
        await render({
            today: {
                cash: null,
                previousOpenSession: {
                    id: 3,
                    sessionDate: "2026-11-09",
                    openedAt: "2026-11-09T08:00:00",
                    openedBy: 1,
                    openedByName: "Awa",
                    balance: 12000,
                },
            },
        });

        // un seul message dans la carte, avec le bouton qui débloque, et pas de bandeau en plus
        expect(text()).toContain("Clôturezd'abordvotrecaissedu9novembre");
        expect(buttons()).toContain("Clôturer la caisse du 9 novembre");
        expect(buttons()).not.toContain("Ouvrir la caisse");
        expect(el.querySelector(".alert-warning")).toBeNull();
    });

    it("should show the last closed cash register when none is open", async () => {
        await render({
            today: { cash: null },
            lastClosed: detail({
                id: 2,
                status: "CLOSED",
                session_date: "2026-11-08",
                actual_amount: 291000,
                difference: -500,
            }),
        });

        expect(text()).toContain("Dernièreclôture");
        expect(text()).toContain("291000F");
    });

    it("should let the manager open the cash when it is closed", async () => {
        await render({ isAdmin: false, today: { cash: null } });

        expect(text()).toContain("Ouvrirlacaisse");
        expect(buttons()).toContain("Ouvrir la caisse");
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

        expect(text()).toContain("De08:00à19:00·fonds5000FClôturée");
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
                    openedBy: 1,
                    openedByName: "Awa",
                    balance: 12000,
                },
            },
        });

        expect(el.querySelector('[role="alert"]')?.textContent).toContain("n'a pas été clôturée");
        expect(buttons()).toContain("La clôturer");
    });

    it("should name the person whose cash register was forgotten open", async () => {
        await render({
            today: {
                previousOpenSession: {
                    id: 3,
                    sessionDate: "2026-11-09",
                    openedAt: "2026-11-09T08:00:00",
                    openedBy: 7,
                    openedByName: "Kevin Bakala",
                    balance: 12000,
                },
            },
        });

        expect(el.querySelector('[role="alert"]')?.textContent).toContain("Kevin Bakala");
    });

    it("should list the cash registers of the team for the owner", async () => {
        await render({
            today: {
                teamSessions: [
                    {
                        id: 5,
                        status: "CLOSED",
                        openedBy: 7,
                        openedByName: "Kevin Bakala",
                        openedAt: "2026-11-12T08:00:00",
                        closedAt: "2026-11-12T18:00:00",
                        difference: -1500,
                        explanationPending: false,
                        salesTotal: 42000,
                    },
                ],
            },
        });

        // fermé par défaut : une ligne de résumé, la liste s'ouvre au toucher
        const team = el.querySelector(".team")!;
        expect(team.textContent).toContain("Aucune ouverte");
        expect(team.textContent).not.toContain("Kevin Bakala");

        team.querySelector<HTMLButtonElement>(".team-toggle")!.click();
        await fixture.whenStable();

        expect(team.textContent).toContain("Kevin Bakala");
        expect(team.textContent).toContain("Écart");
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
        expect(text()).not.toContain("Caissenonouverte");
        expect(buttons()).toContain("Réessayer");
    });
});

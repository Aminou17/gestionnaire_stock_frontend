import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Expenses } from "./expenses";
import { NewExpense } from "./new-expense/new-expense";
import { ExpensePage } from "./expense-page/expense-page";
import { AuthService } from "../../core/auth/auth.service";
import { CashMovementService } from "../../core/cash/cash-movement.service";
import { CashSessionService } from "../../core/cash/cash-session.service";
import { CashMovementRow } from "../../core/cash/cash.model";

const expense = (overrides: Partial<CashMovementRow>): CashMovementRow => ({
    id: 1,
    type: "EXPENSE",
    amount: 2500,
    user_id: 1,
    user_name: "Awa",
    reference_type: "manual",
    reference_id: null,
    reason_category: "TRANSPORT",
    reason: "Taxi",
    session_id: 9,
    created_at: "2026-11-20T10:00:00",
    ...overrides,
});

const auth = {
    provide: AuthService,
    useValue: {
        isAdmin: signal(true),
        isOwner: signal(false),
        user: signal({ id: 1, name: "Awa", email: "a@t.com", role: "admin" }),
        roleLabel: signal("Administrateur"),
    },
};

describe("Expenses", () => {
    let fixture: ComponentFixture<Expenses>;
    let el: HTMLElement;
    let getMovements: ReturnType<typeof vi.fn>;
    let getExpenseSummary: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        getMovements = vi.fn(() =>
            of({
                data: [
                    expense({}),
                    expense({ id: 2, reason_category: "FOOD", reason: "Repas", amount: 1000 }),
                    expense({ id: 3, created_at: "2026-11-18T09:00:00", amount: 500 }),
                ],
                summary: { totalIn: 0, totalOut: 4000 },
                pagination: { page: 1, limit: 25, total: 3, totalPages: 1 },
            }),
        );
        getExpenseSummary = vi.fn(() =>
            of({
                total: 4000,
                count: 3,
                categories: [
                    { category: "TRANSPORT", count: 2, total: 3000 },
                    { category: "FOOD", count: 1, total: 1000 },
                ],
            }),
        );

        await TestBed.configureTestingModule({
            imports: [Expenses],
            providers: [
                provideRouter([]),
                auth,
                { provide: CashMovementService, useValue: { getMovements, getExpenseSummary } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Expenses);
        el = fixture.nativeElement;
        await fixture.whenStable();
    });

    it("should ask only for expenses of the current month", () => {
        const filters = getMovements.mock.lastCall![0];
        expect(filters.type).toBe("EXPENSE");
        expect(filters.from).toMatch(/^\d{4}-\d{2}-01$/);
        expect(getExpenseSummary).toHaveBeenCalledWith(filters.from, filters.to);
    });

    it("should show the total of each reason and group the list by day", () => {
        const names = [...el.querySelectorAll(".split-name")].map((s) => s.textContent?.trim());
        expect(names).toEqual(["Transport", "Repas"]);
        expect(el.querySelector(".split-bar")).toBeNull();
        expect(el.textContent).not.toContain("par jour");
        expect(el.querySelectorAll(".day").length).toBe(2);
        expect(el.querySelector(".day-total")?.textContent).toMatch(/3\s500/);
    });

    it("should filter on a reason from the breakdown, and clear it on a second click", async () => {
        const row = el.querySelector<HTMLButtonElement>(".split-row")!;
        row.click();
        await fixture.whenStable();
        expect(getMovements.mock.lastCall![0].category).toBe("TRANSPORT");

        row.click();
        await fixture.whenStable();
        expect(getMovements.mock.lastCall![0].category).toBeNull();
    });

    it("should take the whole history with the Tout period", async () => {
        [...el.querySelectorAll<HTMLButtonElement>(".period")].at(-1)!.click();
        await fixture.whenStable();

        expect(getMovements.mock.lastCall![0]).toEqual(
            expect.objectContaining({ from: null, to: null, page: 1 }),
        );
    });
});

describe("NewExpense", () => {
    let fixture: ComponentFixture<NewExpense>;
    let create: ReturnType<typeof vi.fn>;

    async function render(status: "OPEN" | null = "OPEN", fails = false) {
        create = vi.fn(() =>
            fails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Votre caisse n'est pas ouverte aujourd'hui." },
                          }),
                  )
                : of({ id: 5 }),
        );

        await TestBed.configureTestingModule({
            imports: [NewExpense],
            providers: [
                provideRouter([]),
                auth,
                { provide: CashMovementService, useValue: { create } },
                {
                    provide: CashSessionService,
                    useValue: {
                        getToday: () =>
                            of({
                                cash: status
                                    ? { id: 9, status, balance: 10000, openingAmount: 5000 }
                                    : null,
                            }),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(NewExpense);
        await fixture.whenStable();
    }

    const component = () => fixture.componentInstance;

    it("should need an amount", async () => {
        await render();
        component().submit();
        await fixture.whenStable();

        expect(create).not.toHaveBeenCalled();
        expect(fixture.nativeElement.textContent).toContain("Entrez un montant");
    });

    it("should save the expense with its reason, then go back", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
        component().onAmount("2 500");
        component().category.set("TRANSPORT");
        component().reason.set("  Taxi  ");

        expect(component().balanceAfter()).toBe(7500);
        component().submit();
        await fixture.whenStable();

        expect(create).toHaveBeenCalledWith("EXPENSE", 2500, "TRANSPORT", "Taxi");
        expect(navigate).toHaveBeenCalled();
    });

    it("should save without a description", async () => {
        await render();
        vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
        component().onAmount("1000");
        component().category.set("FOOD");
        component().submit();
        await fixture.whenStable();

        expect(create).toHaveBeenCalledWith("EXPENSE", 1000, "FOOD", "");
    });

    it("should say the cash is closed and block the button", async () => {
        await render(null);
        const el: HTMLElement = fixture.nativeElement;

        expect(el.textContent).toContain("Votre caisse n'est pas ouverte");
        expect(el.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled).toBe(true);
    });

    it("should show the message of the server", async () => {
        await render("OPEN", true);
        component().onAmount("1000");
        component().reason.set("Repas");
        component().submit();
        await fixture.whenStable();

        expect(component().error()).toBe("Votre caisse n'est pas ouverte aujourd'hui.");
    });
});

describe("ExpensePage", () => {
    async function render(type: "EXPENSE" | "DEPOSIT" = "EXPENSE") {
        await TestBed.configureTestingModule({
            imports: [ExpensePage],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ id: "1" }) } },
                },
                {
                    provide: CashMovementService,
                    useValue: { getMovement: () => of(expense({ type })) },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(ExpensePage);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    it("should show the amount, the reason and a link to the cash of the day", async () => {
        const el = await render();

        expect(el.querySelector(".hero-amount")?.textContent).toMatch(/2\s500/);
        expect(el.textContent).toContain("Taxi");
        expect(el.querySelector("a[href='/cash/sessions/9']")).not.toBeNull();
    });

    it("should refuse another kind of cash movement", async () => {
        const el = await render("DEPOSIT");
        expect(el.textContent).toContain("Cette dépense est introuvable.");
    });
});

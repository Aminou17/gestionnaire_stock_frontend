import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";

import { CashMovementList } from "./cash-movement-list";
import { CashMovement } from "../../../core/cash/cash.model";

const movement = (overrides: Partial<CashMovement>): CashMovement => ({
    id: 1,
    type: "SALE",
    amount: 3000,
    user_id: 2,
    user_name: "Awa K.",
    reference_type: "sale",
    reference_id: 12,
    reason: null,
    reason_category: null,
    created_at: "2026-11-10T09:30:00",
    ...overrides,
});

describe("CashMovementList", () => {
    let fixture: ComponentFixture<CashMovementList>;
    let el: HTMLElement;

    async function render(movements: CashMovement[]) {
        await TestBed.configureTestingModule({
            imports: [CashMovementList],
            providers: [provideRouter([{ path: "sales/:id", component: CashMovementList }])],
        }).compileComponents();

        fixture = TestBed.createComponent(CashMovementList);
        fixture.componentRef.setInput("movements", movements);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should send the current page as the back link of a sale", async () => {
        await render([movement({ id: 1 })]);
        const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl");
        el.querySelector<HTMLAnchorElement>("a.label")!.click();

        expect(navigate.mock.calls[0][1]?.state).toEqual({ backTo: "/", backLabel: "Caisse" });
    });

    it("should show money in with a plus and money out with a minus", async () => {
        await render([
            movement({ id: 1 }),
            movement({
                id: 2,
                type: "EXPENSE",
                amount: 500,
                reference_type: null,
                reference_id: null,
            }),
        ]);

        expect(text()).toContain("+3 000 F");
        expect(text()).toContain("−500 F");
        expect(text()).toContain("Dépense");
    });

    it("should link a sale and a refund to the sale, but not a manual movement", async () => {
        await render([
            movement({ id: 1 }),
            movement({
                id: 2,
                type: "WITHDRAWAL",
                reference_type: "SALE_CANCELLATION",
                reference_id: 9,
            }),
            movement({ id: 3, type: "DEPOSIT", reference_type: null, reference_id: null }),
        ]);

        const links = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
        expect(links).toEqual(["/sales/12", "/sales/9"]);
    });

    it("should show the time and who made the movement", async () => {
        await render([movement({})]);

        expect(text()).toContain("09:30");
        expect(text()).toContain("Awa K.");
    });

    it("should open the details of a manual movement", async () => {
        await render([
            movement({
                type: "EXPENSE",
                reference_type: null,
                reference_id: null,
                reason: "taxi du matin",
            }),
        ]);
        const dialog = el.querySelector("dialog")!;
        dialog.showModal = vi.fn();
        el.querySelector<HTMLButtonElement>("button.label")!.click();
        await fixture.whenStable();

        expect(dialog.showModal).toHaveBeenCalled();
        expect(dialog.textContent).toContain("Awa K.");
        expect(dialog.textContent).toContain("taxi du matin");
    });

    it("should show the empty text when there is no movement", async () => {
        await render([]);

        expect(text()).toContain("Aucun mouvement pour le moment.");
    });
});

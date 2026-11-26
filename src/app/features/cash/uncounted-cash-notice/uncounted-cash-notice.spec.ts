import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UncountedCashNotice } from "./uncounted-cash-notice";
import { UncountedSession } from "../../../core/cash/cash.model";

const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

const session = (overrides: Partial<UncountedSession> = {}): UncountedSession => ({
    id: 3,
    sessionDate: isoDaysAgo(1),
    openedAt: `${isoDaysAgo(1)}T08:00:00`,
    openedBy: 2,
    openedByName: "Adam Kone",
    balance: 12000,
    count: 1,
    ...overrides,
});

describe("UncountedCashNotice", () => {
    let fixture: ComponentFixture<UncountedCashNotice>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [UncountedCashNotice],
        }).compileComponents();
        fixture = TestBed.createComponent(UncountedCashNotice);
        el = fixture.nativeElement;
    });

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should say yesterday's cash register was not counted, with the expected amount", async () => {
        fixture.componentRef.setInput("session", session());
        await fixture.whenStable();

        expect(text()).toContain("Caisse d'hier non comptée");
        expect(text().replace(/\s/g, "")).toContain("Attendu12000F");
    });

    it("should give the date of an older cash register", async () => {
        fixture.componentRef.setInput("session", session({ sessionDate: isoDaysAgo(5) }));
        await fixture.whenStable();

        expect(text()).toMatch(/Caisse du \d+ \S+ non comptée/);
    });

    it("should hide the expected amount when it is unknown (blind counting)", async () => {
        fixture.componentRef.setInput("session", session({ balance: null }));
        await fixture.whenStable();

        expect(text()).not.toContain("Attendu");
    });

    it("should mention the other uncounted ones", async () => {
        fixture.componentRef.setInput("session", session({ count: 3 }));
        await fixture.whenStable();

        expect(text()).toContain("2 autres");
    });

    it("should emit when the user wants to count", async () => {
        const count = vi.fn();
        fixture.componentInstance.count.subscribe(count);
        fixture.componentRef.setInput("session", session());
        await fixture.whenStable();

        el.querySelector<HTMLButtonElement>("button")!.click();

        expect(count).toHaveBeenCalled();
    });
});

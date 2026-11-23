import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { ManagerCashBanner } from "./manager-cash-banner";
import { CashSummary } from "../../../core/cash/cash.model";

const openCash: CashSummary = {
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

describe("ManagerCashBanner", () => {
    let fixture: ComponentFixture<ManagerCashBanner>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ManagerCashBanner],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(ManagerCashBanner);
        el = fixture.nativeElement;
    });

    const text = () => el.textContent!.replace(/\s/g, " ");
    const newSale = () => el.querySelector(".new-sale")!;

    it("should show the balance and allow a sale when the cash register is in progress", async () => {
        fixture.componentRef.setInput("cash", openCash);
        await fixture.whenStable();

        expect(text()).toContain("Caisse");
        expect(text()).toContain("Depuis 08:05");
        expect(text()).toContain("312 000 F");
        expect(newSale().getAttribute("href")).toBe("/sales/new");
    });

    it("should hide the balance when the counting is blind", async () => {
        fixture.componentRef.setInput("cash", { ...openCash, balance: null, openingAmount: null });
        await fixture.whenStable();

        expect(text()).toContain("Caisse");
        expect(text()).not.toContain("Solde");
    });

    it("should announce the opening amount and let the manager sell before any cash exists", async () => {
        fixture.componentRef.setInput("expectedOpening", 12000);
        await fixture.whenStable();

        expect(text()).toContain("La caisse s'ouvrira avec 12 000 F");
        expect(newSale().textContent).toContain("Nouvelle vente");
        expect(newSale().getAttribute("href")).toBe("/sales/new");
    });

    it("should say the cash opens with the first sale when the amount is unknown", async () => {
        await fixture.whenStable();

        expect(text()).toContain("Elle s'ouvrira à la première vente");
    });

    it("should show a counted cash register with its gap and still allow a sale", async () => {
        fixture.componentRef.setInput("cash", {
            ...openCash,
            status: "CLOSED",
            closedAt: "2026-11-11T18:00:00",
            difference: 500,
        });
        await fixture.whenStable();

        expect(text()).toContain("Caisse comptée");
        expect(text()).toContain("Écart +500 F");
        expect(newSale().getAttribute("href")).toBe("/sales/new");
    });

    it("should show a skeleton while loading", async () => {
        fixture.componentRef.setInput("loading", true);
        await fixture.whenStable();

        expect(el.querySelector(".skeleton")).not.toBeNull();
        expect(text()).not.toContain("La caisse s'ouvrira");
        expect(el.querySelector(".new-sale")).toBeNull();
    });

    it("should offer to retry when the cash state cannot be loaded", async () => {
        const retry = vi.fn();
        fixture.componentInstance.retry.subscribe(retry);
        fixture.componentRef.setInput("error", true);
        await fixture.whenStable();

        expect(text()).toContain("État de la caisse indisponible");
        expect(text()).not.toContain("Caisse pas encore ouverte");
        el.querySelector<HTMLButtonElement>(".link-btn")!.click();
        expect(retry).toHaveBeenCalled();
    });
});

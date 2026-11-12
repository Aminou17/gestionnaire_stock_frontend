import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { ManagerCashBanner } from "./manager-cash-banner";
import { CashSummary } from "../dashboard.model";

const openCash: CashSummary = {
    id: 1,
    status: "OPEN",
    openingAmount: 50000,
    balance: 312000,
    openedAt: "2026-11-11T08:05:00",
    openedByName: "Admin",
    closedAt: null,
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

    it("should show the balance and allow a sale when the cash register is open", async () => {
        fixture.componentRef.setInput("cash", openCash);
        await fixture.whenStable();

        expect(text()).toContain("Caisse ouverte");
        expect(text()).toContain("Depuis 08:05");
        expect(text()).toContain("312 000 F");
        expect(newSale().classList).not.toContain("disabled");
        expect(newSale().getAttribute("href")).toBe("/sales/new");
    });

    it("should ask to call the admin and block sales when the cash register is closed", async () => {
        await fixture.whenStable();

        expect(text()).toContain("Caisse fermée");
        expect(text()).toContain("Demandez au propriétaire de l'ouvrir");
        expect(newSale().classList).toContain("disabled");
        expect(newSale().getAttribute("aria-disabled")).toBe("true");
        expect(el.querySelector("button")).toBeNull();
    });

    it("should show a skeleton while loading", async () => {
        fixture.componentRef.setInput("loading", true);
        await fixture.whenStable();

        expect(el.querySelector(".skeleton")).not.toBeNull();
        expect(text()).not.toContain("Caisse fermée");
        expect(newSale().classList).toContain("disabled");
    });

    it("should offer to retry when the cash state cannot be loaded", async () => {
        const retry = vi.fn();
        fixture.componentInstance.retry.subscribe(retry);
        fixture.componentRef.setInput("error", true);
        await fixture.whenStable();

        expect(text()).toContain("État de la caisse indisponible");
        expect(text()).not.toContain("Caisse fermée");
        el.querySelector<HTMLButtonElement>(".link-btn")!.click();
        expect(retry).toHaveBeenCalled();
    });
});

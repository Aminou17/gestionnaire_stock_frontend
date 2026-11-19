import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { BottomNav } from "./bottom-nav";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { LayoutService } from "../layout.service";

describe("BottomNav", () => {
    let fixture: ComponentFixture<BottomNav>;
    let el: HTMLElement;
    const count = signal(3);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BottomNav],
            providers: [provideRouter([]), { provide: LowStockAlertService, useValue: { count } }],
        }).compileComponents();

        fixture = TestBed.createComponent(BottomNav);
        el = fixture.nativeElement;
        await fixture.whenStable();
    });

    it("should show the main links", () => {
        expect(el.textContent).toContain("Accueil");
        expect(el.textContent).toContain("Produits");
        expect(el.textContent).toContain("Caisse");
    });

    it("should offer a Vendre button that opens the new sale page", () => {
        const sell = el.querySelector<HTMLAnchorElement>("a.sell")!;
        expect(sell.textContent).toContain("Vendre");
        expect(sell.getAttribute("href")).toBe("/sales/new");
    });

    it("should open the full menu with Plus", () => {
        el.querySelector<HTMLButtonElement>("button")!.click();
        expect(TestBed.inject(LayoutService).sidebarOpen()).toBe(true);
    });

    it("should not repeat the alert count on the Plus button (it is on the bell)", () => {
        const button = el.querySelector("button")!;
        expect(button.textContent).toContain("Plus");
        expect(button.querySelector(".badge")).toBeNull();
    });
});

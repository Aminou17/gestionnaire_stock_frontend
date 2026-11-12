import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { BottomNav } from "./bottom-nav";
import { LayoutService } from "../layout.service";

describe("BottomNav", () => {
    let fixture: ComponentFixture<BottomNav>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BottomNav],
            providers: [provideRouter([])],
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

    it("should open the full menu with Plus", () => {
        el.querySelector<HTMLButtonElement>("button")!.click();
        expect(TestBed.inject(LayoutService).sidebarOpen()).toBe(true);
    });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CashCounter } from "./cash-counter";

describe("CashCounter", () => {
    let fixture: ComponentFixture<CashCounter>;
    let component: CashCounter;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [CashCounter] }).compileComponents();
        fixture = TestBed.createComponent(CashCounter);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it("should sum the notes and coins", () => {
        component.set(10000, "2");
        component.set(500, "3");
        component.set(25, "4");

        expect(component.total()).toBe(21600);
    });

    it("should tell the parent the new total at each change", () => {
        const changed = vi.fn();
        component.totalChange.subscribe(changed);

        component.set(1000, "5");
        component.set(500, "1");

        expect(changed).toHaveBeenLastCalledWith(5500);
    });

    it("should ignore negative and decimal quantities", () => {
        component.set(1000, "-3");
        expect(component.total()).toBe(0);

        component.set(1000, "2.7");
        expect(component.total()).toBe(2000);
    });

    it("should start again from zero", () => {
        component.set(1000, "5");
        component.reset();

        expect(component.total()).toBe(0);
    });

    it("should open and close without losing the counted quantities", async () => {
        const toggle = () => fixture.nativeElement.querySelector(".toggle") as HTMLButtonElement;
        expect(fixture.nativeElement.querySelector(".grid")).toBeNull();

        toggle().click();
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelector(".grid")).not.toBeNull();

        component.set(1000, "2");
        toggle().click();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector(".grid")).toBeNull();
        expect(component.total()).toBe(2000);
    });
});

import { Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import { PhoneField } from "./phone-field";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";

@Component({
    imports: [ReactiveFormsModule, PhoneField],
    template: `<app-phone-field [formControl]="phone" label="Téléphone" />`,
})
class Host {
    phone = new FormControl("");
}

describe("PhoneField", () => {
    let fixture: ComponentFixture<Host>;
    let el: HTMLElement;
    let shopCode: ReturnType<typeof signal<string>>;

    const codeInput = () =>
        el.querySelector<HTMLInputElement>("input[aria-label='Indicatif du pays']")!;
    const numberInput = () => el.querySelector<HTMLInputElement>("input[type='tel']")!;

    const type = (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.dispatchEvent(new Event("input"));
        fixture.detectChanges();
    };

    beforeEach(async () => {
        shopCode = signal("242");
        TestBed.configureTestingModule({
            providers: [
                { provide: ShopSettingsService, useValue: { defaultCountryCode: shopCode } },
            ],
        });
        fixture = TestBed.createComponent(Host);
        el = fixture.nativeElement;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it("should start with the shop country code and no number", () => {
        expect(codeInput().value).toBe("242");
        expect(numberInput().value).toBe("");
        expect(fixture.componentInstance.phone.value).toBe("");
    });

    it("should write the international number in the form", () => {
        type(numberInput(), "66099060");

        expect(fixture.componentInstance.phone.value).toBe("+242 66 09 90 60");
    });

    it("should send an empty value when the number is cleared", () => {
        type(numberInput(), "66099060");
        type(numberInput(), "");

        expect(fixture.componentInstance.phone.value).toBe("");
    });

    it("should keep only 4 digits without a leading zero in the code", () => {
        type(codeInput(), "0226789");

        expect(codeInput().value).toBe("2267");
    });

    it("should use the typed code for the value", () => {
        type(codeInput(), "226");
        type(numberInput(), "66099060");

        expect(fixture.componentInstance.phone.value).toBe("+226 66 09 90 60");
    });

    it("should fill both fields with a pasted international number", () => {
        type(numberInput(), "+33 6 12 34 56 78");

        expect(codeInput().value).toBe("33");
        expect(numberInput().value).toBe("6 12 34 56 78");
        expect(fixture.componentInstance.phone.value).toBe("+33 6 12 34 56 78");
    });

    it("should split a saved number into code and number", () => {
        fixture.componentInstance.phone.setValue("+226 66 09 90 60");
        fixture.detectChanges();

        expect(codeInput().value).toBe("226");
        expect(numberInput().value).toBe("66 09 90 60");
    });

    it("should give the shop code to a saved number without plus", () => {
        shopCode.set("226");
        fixture.componentInstance.phone.setValue("66099060");
        fixture.detectChanges();

        expect(codeInput().value).toBe("226");
        expect(numberInput().value).toBe("66 09 90 60");
    });

    it("should go back to the shop code when the form is reset", () => {
        type(codeInput(), "226");
        fixture.componentInstance.phone.setValue("");
        fixture.detectChanges();

        expect(codeInput().value).toBe("242");
    });

    it("should show the country name of the code", () => {
        type(codeInput(), "226");

        expect(el.textContent).toContain("Burkina Faso");
    });

    it("should disable both inputs when the control is disabled", () => {
        fixture.componentInstance.phone.disable();
        fixture.detectChanges();

        expect(codeInput().disabled).toBe(true);
        expect(numberInput().disabled).toBe(true);
    });
});

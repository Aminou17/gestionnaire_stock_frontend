import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { CustomerForm } from "./customer-form";
import { Customer } from "../../../core/customers/customer.model";
import { CustomerService } from "../../../core/customers/customer.service";

const awa: Customer = {
    id: 4,
    name: "Awa Kouba",
    phone: "06 123 45 67",
    note: null,
    is_active: true,
    created_at: "2026-11-01T10:00:00Z",
    purchases_count: 0,
    total_spent: 0,
    due_amount: 0,
    last_purchase_at: null,
};

describe("CustomerForm", () => {
    let fixture: ComponentFixture<CustomerForm>;
    let el: HTMLElement;
    let createCustomer: ReturnType<typeof vi.fn>;
    let updateCustomer: ReturnType<typeof vi.fn>;

    async function render({ duplicate = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        const answer = () =>
            duplicate
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: {
                                  message: "Ce numéro est déjà celui de Awa Kouba.",
                                  existing: { id: 4, name: "Awa Kouba", is_active: true },
                              },
                          }),
                  )
                : of(awa);
        createCustomer = vi.fn(answer);
        updateCustomer = vi.fn(answer);

        await TestBed.configureTestingModule({
            imports: [CustomerForm],
            providers: [
                provideRouter([]),
                { provide: CustomerService, useValue: { createCustomer, updateCustomer } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CustomerForm);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s/g, " ");
    const form = () => fixture.componentInstance.form;
    const submit = async () => {
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();
    };

    it("should require a name", async () => {
        await render();
        fixture.componentInstance.openNew();
        form().controls.name.setValue("   ");
        await submit();

        expect(createCustomer).not.toHaveBeenCalled();
        expect(text()).toContain("Le nom est obligatoire.");
    });

    const codeInput = () =>
        el.querySelector<HTMLInputElement>("input[aria-label='Indicatif du pays']")!;
    const numberInput = () => el.querySelector<HTMLInputElement>("input[type='tel']")!;
    const type = async (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    };

    it("should show the shop country code in the phone field", async () => {
        await render();
        fixture.componentInstance.openNew();
        await fixture.whenStable();

        expect(codeInput().value).toBe("242");
        expect(form().controls.phone.value).toBe("");
    });

    it("should save the phone in international format and keep letters out", async () => {
        await render();
        fixture.componentInstance.openNew();
        form().controls.name.setValue("Awa");
        await type(numberInput(), "06 12ab3 4567");
        numberInput().dispatchEvent(new Event("blur"));
        await submit();

        expect(numberInput().value).toBe("06 123 45 67");
        expect(createCustomer).toHaveBeenCalledWith({
            name: "Awa",
            phone: "+242 06 123 45 67",
            note: null,
        });
    });

    it("should use another country code when the user changes it", async () => {
        await render();
        fixture.componentInstance.openNew();
        await type(codeInput(), "+226");
        await type(numberInput(), "66099060");

        expect(codeInput().value).toBe("226");
        expect(form().controls.phone.value).toBe("+226 66 09 90 60");
    });

    it("should split a number pasted with its country code", async () => {
        await render();
        fixture.componentInstance.openNew();
        await type(numberInput(), "+226 66 09 90 60");

        expect(codeInput().value).toBe("226");
        expect(numberInput().value).toBe("66 09 90 60");
        expect(form().controls.phone.value).toBe("+226 66 09 90 60");
    });

    it("should fill the fields of a saved international number", async () => {
        await render();
        fixture.componentInstance.openEdit({ ...awa, phone: "+226 66 09 90 60" });
        await fixture.whenStable();

        expect(codeInput().value).toBe("226");
        expect(numberInput().value).toBe("66 09 90 60");
    });

    it("should create the customer with empty fields sent as null", async () => {
        await render();
        const saved = vi.fn();
        fixture.componentInstance.saved.subscribe(saved);
        fixture.componentInstance.openNew();
        form().controls.name.setValue("  Awa Kouba ");
        await submit();

        expect(createCustomer).toHaveBeenCalledWith({ name: "Awa Kouba", phone: null, note: null });
        expect(saved).toHaveBeenCalledWith(awa);
    });

    it("should not call the API when nothing changed", async () => {
        await render();
        fixture.componentInstance.openEdit(awa);
        await submit();

        expect(updateCustomer).not.toHaveBeenCalled();
    });

    it("should offer the existing sheet when the phone is already taken", async () => {
        await render({ duplicate: true });
        fixture.componentInstance.openNew();
        form().controls.name.setValue("Doublon");
        form().controls.phone.setValue("06 123 45 67");
        await submit();
        await fixture.whenStable();

        expect(text()).toContain("Ce numéro est déjà celui de Awa Kouba");

        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
        el.querySelector<HTMLButtonElement>(".duplicate button")!.click();
        expect(navigate).toHaveBeenCalledWith(["/customers", 4]);
    });
});

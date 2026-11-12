import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";

import { SupplierForm } from "./supplier-form";
import { Supplier } from "../../../core/stock/supplier.model";
import { SupplierService } from "../../../core/stock/supplier.service";

const faso: Supplier = {
    id: 4,
    name: "Faso Distribution",
    contact: "Moussa Traoré",
    telephone: "70123456",
    email: null,
    address: null,
    created_at: null,
    is_active: true,
};

describe("SupplierForm", () => {
    let fixture: ComponentFixture<SupplierForm>;
    let el: HTMLElement;
    let createSupplier: ReturnType<typeof vi.fn>;
    let updateSupplier: ReturnType<typeof vi.fn>;

    async function render({ fails = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        const answer = () =>
            fails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 409,
                              error: { message: "Un fournisseur avec ce nom existe déjà." },
                          }),
                  )
                : of(faso);
        createSupplier = vi.fn(answer);
        updateSupplier = vi.fn(answer);

        await TestBed.configureTestingModule({
            imports: [SupplierForm],
            providers: [{ provide: SupplierService, useValue: { createSupplier, updateSupplier } }],
        }).compileComponents();

        fixture = TestBed.createComponent(SupplierForm);
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

        expect(createSupplier).not.toHaveBeenCalled();
        expect(text()).toContain("Le nom est obligatoire.");
    });

    it("should refuse an invalid email", async () => {
        await render();
        fixture.componentInstance.openNew();
        form().patchValue({ name: "Wax Lomé", email: "pas-un-email" });
        await submit();

        expect(createSupplier).not.toHaveBeenCalled();
        expect(text()).toContain("Adresse email invalide.");
    });

    it("should send empty fields as null and emit the saved supplier", async () => {
        await render();
        const saved = vi.fn();
        fixture.componentInstance.saved.subscribe(saved);
        fixture.componentInstance.openNew();
        form().patchValue({ name: " Wax Lomé ", telephone: " 06 123 45 67 " });
        await submit();

        expect(createSupplier).toHaveBeenCalledWith({
            name: "Wax Lomé",
            contact: null,
            telephone: "06 123 45 67",
            email: null,
            address: null,
        });
        expect(saved).toHaveBeenCalledWith(faso);
    });

    it("should prefill the form and update with PUT", async () => {
        await render();
        fixture.componentInstance.openEdit(faso);
        await fixture.whenStable();

        expect(text()).toContain("Modifier le fournisseur");
        expect(form().controls.contact.value).toBe("Moussa Traoré");

        form().controls.address.setValue("Marché Total");
        await submit();

        expect(updateSupplier).toHaveBeenCalledWith(
            4,
            expect.objectContaining({ address: "Marché Total" }),
        );
    });

    it("should not call the backend when nothing changed", async () => {
        await render();
        fixture.componentInstance.openEdit(faso);
        await submit();

        expect(updateSupplier).not.toHaveBeenCalled();
    });

    it("should show the backend message", async () => {
        await render({ fails: true });
        fixture.componentInstance.openNew();
        form().controls.name.setValue("Faso Distribution");
        await submit();

        expect(text()).toContain("Un fournisseur avec ce nom existe déjà.");
    });
});

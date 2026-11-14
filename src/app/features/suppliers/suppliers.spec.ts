import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { Router, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { Suppliers } from "./suppliers";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Supplier } from "../../core/stock/supplier.model";
import { SupplierService } from "../../core/stock/supplier.service";

const faso: Supplier = {
    id: 4,
    name: "Faso Distribution",
    contact: "Moussa Traoré",
    telephone: "70123456",
    email: "faso@test.com",
    address: "Bobo-Dioulasso",
    created_at: "2026-10-26T23:17:29Z",
    is_active: true,
};

const sahel: Supplier = {
    ...faso,
    id: 5,
    name: "Sahel Commerce",
    contact: null,
    telephone: null,
    email: null,
    address: null,
};

const ancien: Supplier = { ...faso, id: 6, name: "Ancien fournisseur", is_active: false };

describe("Suppliers", () => {
    let fixture: ComponentFixture<Suppliers>;
    let el: HTMLElement;
    let getSuppliers: ReturnType<typeof vi.fn>;
    let deleteSupplier: ReturnType<typeof vi.fn>;
    let restoreSupplier: ReturnType<typeof vi.fn>;

    async function render({ deleteFails = false } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        getSuppliers = vi.fn(() => of([faso, sahel, ancien]));
        deleteSupplier = vi.fn(() =>
            deleteFails
                ? throwError(
                      () =>
                          new HttpErrorResponse({
                              status: 404,
                              error: { message: "Fournisseur introuvable ou déjà désactivé." },
                          }),
                  )
                : of({ message: "ok" }),
        );

        restoreSupplier = vi.fn(() => of({ ...ancien, is_active: true }));

        await TestBed.configureTestingModule({
            imports: [Suppliers],
            providers: [
                provideRouter([]),
                {
                    provide: SupplierService,
                    useValue: { getSuppliers, deleteSupplier, restoreSupplier },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        user: signal({
                            id: 1,
                            name: "Admin Test",
                            email: "a@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Suppliers);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const rows = () => el.querySelectorAll(".row");

    it("should load every supplier and list the active ones with their contact", async () => {
        await render();

        expect(getSuppliers).toHaveBeenCalledWith("all");
        expect(rows().length).toBe(2);
        expect(text()).toContain("Moussa Traoré · 70 12 34 56");
        expect(text()).toContain("Aucun contact");
        expect(text()).not.toContain("Ancien fournisseur");
        expect(text()).toContain("Actifs 2");
        expect(text()).toContain("Supprimés 1");
    });

    it("should show the deleted suppliers in their tab, with a restore button", async () => {
        await render();
        el.querySelectorAll<HTMLButtonElement>(".chip")[1].click();
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Ancien fournisseur");
        expect(el.querySelector(".more-btn")).toBeNull();

        el.querySelector<HTMLButtonElement>(".restore-btn")!.click();
        await fixture.whenStable();

        expect(restoreSupplier).toHaveBeenCalledWith(6);
        expect(getSuppliers).toHaveBeenCalledTimes(2);
    });

    it("should find a supplier by its email", async () => {
        await render();
        fixture.componentInstance.search.set("faso@");
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Faso Distribution");
    });

    it("should say how many products keep the supplier before deleting it", async () => {
        await render();
        fixture.componentInstance.askDelete({ ...faso, product_count: 3 });
        await fixture.whenStable();

        expect(el.querySelector(".linked-products")?.textContent).toContain(
            "3 produits en vente gardent ce fournisseur",
        );
    });

    it("should search in the name, the contact and the phone", async () => {
        await render();
        fixture.componentInstance.search.set("moussa");
        await fixture.whenStable();

        expect(rows().length).toBe(1);
        expect(text()).toContain("Faso Distribution");
    });

    it("should open the supplier page when a row is clicked", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        rows()[0].querySelector<HTMLButtonElement>(".name")!.click();

        expect(navigate).toHaveBeenCalledWith(["/suppliers", 4]);
    });

    it("should not open the supplier page when the menu is used", async () => {
        await render();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();

        expect(navigate).not.toHaveBeenCalled();
        expect(el.querySelector(".menu")?.textContent).toContain("Modifier");
    });

    it("should delete after confirmation and reload the list", async () => {
        await render();
        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".menu .danger")!.click();
        await fixture.whenStable();

        expect(text()).toContain("« Faso Distribution » ne sera plus proposé");
        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();
        await fixture.whenStable();

        expect(deleteSupplier).toHaveBeenCalledWith(4);
        expect(getSuppliers).toHaveBeenCalledTimes(2);
    });

    it("should show the backend message when the deletion fails", async () => {
        await render({ deleteFails: true });
        fixture.componentInstance.askDelete(faso);
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();
        await fixture.whenStable();

        expect(text()).toContain("Fournisseur introuvable ou déjà désactivé.");
    });

    it("should offer to retry when the list cannot be loaded", async () => {
        await render();
        getSuppliers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        fixture.componentInstance.suppliers.set(undefined);
        fixture.componentInstance.suppliers.reload();
        await fixture.whenStable();

        expect(text()).toContain("Impossible de charger les fournisseurs.");
        expect(text()).toContain("Réessayer");
    });
});

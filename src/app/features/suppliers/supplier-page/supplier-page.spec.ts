import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { SupplierPage } from "./supplier-page";
import { AuthService } from "../../../core/auth/auth.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { StockEntryPage } from "../../../core/stock/stock-entry.model";
import { StockEntryService } from "../../../core/stock/stock-entry.service";
import { Supplier } from "../../../core/stock/supplier.model";
import { SupplierService } from "../../../core/stock/supplier.service";

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

const deliveries: StockEntryPage = {
    data: [
        {
            id: 11,
            product_id: 3,
            product_name: "Bazin riche bleu",
            supplier_id: 4,
            supplier_name: "Faso Distribution",
            user_id: 1,
            user_name: "Admin Test",
            quantity: 5,
            date_creation: "2026-10-28T12:33:48Z",
        },
    ],
    total: 7,
    counters: { entries: 7, units: 61, products: 3, suppliers: 1 },
};

const none: StockEntryPage = {
    data: [],
    total: 0,
    counters: { entries: 0, units: 0, products: 0, suppliers: 0 },
};

describe("SupplierPage", () => {
    let fixture: ComponentFixture<SupplierPage>;
    let el: HTMLElement;
    let getSupplier: ReturnType<typeof vi.fn>;
    let getEntries: ReturnType<typeof vi.fn>;
    let deleteSupplier: ReturnType<typeof vi.fn>;
    let restoreSupplier: ReturnType<typeof vi.fn>;

    async function render({ id = "4", supplier = faso, entries = deliveries, status = 0 } = {}) {
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        getSupplier = vi.fn(() =>
            status ? throwError(() => new HttpErrorResponse({ status, error: {} })) : of(supplier),
        );
        getEntries = vi.fn(() => of(entries));
        deleteSupplier = vi.fn(() => of({ message: "ok" }));
        restoreSupplier = vi.fn(() => of({ ...supplier, is_active: true }));

        await TestBed.configureTestingModule({
            imports: [SupplierPage],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
                {
                    provide: SupplierService,
                    useValue: {
                        getSupplier,
                        deleteSupplier,
                        restoreSupplier,
                        updateSupplier: vi.fn(),
                    },
                },
                { provide: StockEntryService, useValue: { getEntries } },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
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

        fixture = TestBed.createComponent(SupplierPage);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should show the contact details with phone and email links", async () => {
        await render();

        expect(text()).toContain("Moussa Traoré");
        expect(text()).toContain("Bobo-Dioulasso");
        expect(text()).toContain("Ajouté le");
        expect(el.querySelector('a[href="tel:+24270123456"]')?.textContent).toContain(
            "70 12 34 56",
        );
        expect(el.querySelector('a[href="https://wa.me/24270123456"]')).not.toBeNull();
        expect(el.querySelector('a[href="mailto:faso@test.com"]')).not.toBeNull();
    });

    it("should offer to add the missing details", async () => {
        await render({
            supplier: { ...faso, telephone: null, email: null, created_at: null },
        });

        expect(el.querySelectorAll("dd .link-btn").length).toBe(2);
        expect(el.querySelector('a[href^="tel:"]')).toBeNull();
        expect(text()).not.toContain("Ajouté le");
    });

    it("should show the products of this supplier with a link to them", async () => {
        await render({ supplier: { ...faso, product_count: 2 } });

        expect(text()).toContain("2 produits en vente");
        expect(el.querySelector(".products-line a")?.getAttribute("href")).toBe(
            "/products?supplierId=4",
        );
    });

    it("should load the last deliveries of this supplier with their totals", async () => {
        await render();

        expect(getEntries).toHaveBeenCalledWith(
            expect.objectContaining({ supplierId: 4, page: 1, limit: 5 }),
        );
        const stats = [...el.querySelectorAll(".stats div")].map((stat) =>
            stat.textContent!.replace(/\s+/g, " ").trim(),
        );
        expect(stats).toEqual(["7 livraisons", "61 unités reçues", "3 produits livrés"]);
        const product = el.querySelector(".preview a");
        expect(product?.getAttribute("href")).toBe("/products/3");
        expect(product?.textContent).toContain("+5");
    });

    it("should link to the stock entries filtered on this supplier", async () => {
        await render();

        const link = el.querySelector(".sheet .actions a");
        expect(link?.getAttribute("href")).toBe("/stock-entries?supplierId=4");
        expect(link?.textContent).toContain("Voir les 7 livraisons");
    });

    it("should say when nothing was delivered yet", async () => {
        await render({ entries: none });

        expect(text()).toContain("Aucune livraison enregistrée pour ce fournisseur.");
        expect(el.querySelector(".sheet .actions a")?.getAttribute("href")).toBe(
            "/stock-entries/new?supplierId=4",
        );
    });

    it("should offer to edit and delete an active supplier", async () => {
        await render();

        expect(el.querySelector(".manage")?.textContent).toContain("Modifier");
        expect(el.querySelector(".manage")?.textContent).toContain("Supprimer");
    });

    it("should only offer to restore a deleted supplier", async () => {
        await render({ supplier: { ...faso, is_active: false } });

        expect(text()).toContain("Supprimé");
        expect(el.querySelector(".manage")).toBeNull();
        expect(el.querySelector('.sheet a[href^="/stock-entries"]')).toBeNull();
        // ses livraisons passées restent visibles
        expect(el.querySelector(".preview a")).not.toBeNull();

        el.querySelector<HTMLButtonElement>(".sheet .actions .btn-primary")!.click();
        await fixture.whenStable();

        expect(restoreSupplier).toHaveBeenCalledWith(4);
        expect(getSupplier).toHaveBeenCalledTimes(2);
    });

    it("should go back to the list after deleting", async () => {
        await render();
        // la fiche est quittée sans rester dans l'historique
        const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(".manage .danger")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();
        await fixture.whenStable();

        expect(deleteSupplier).toHaveBeenCalledWith(4);
        expect(navigate).toHaveBeenCalledWith("/suppliers", { replaceUrl: true });
    });

    it("should say the supplier does not exist on a 404", async () => {
        await render({ status: 404 });

        expect(text()).toContain("Ce fournisseur est introuvable.");
        expect(el.querySelector(".empty a")?.getAttribute("href")).toBe("/suppliers");
    });

    it("should not call the backend for an invalid id", async () => {
        await render({ id: "abc" });

        expect(getSupplier).not.toHaveBeenCalled();
        expect(text()).toContain("Ce fournisseur est introuvable.");
    });

    it("should offer to retry on another error", async () => {
        await render({ status: 500 });

        expect(text()).toContain("Impossible de charger le fournisseur.");
        expect(text()).toContain("Réessayer");
    });
});

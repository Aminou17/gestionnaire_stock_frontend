import { signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { SupplierOrder } from "./supplier-order";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { LowStockAlert } from "../../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { SupplierService } from "../../../core/stock/supplier.service";

const alert = (over: Partial<LowStockAlert>): LowStockAlert => ({
    id: 1,
    name: "Bazin riche bleu",
    category_id: 1,
    category_name: "Tissus",
    supplier_id: 4,
    supplier_name: "Ets Ouédraogo",
    supplier_contact: "Mireille Mavoungou",
    supplier_phone: "06 612 34 56",
    last_entry_at: null,
    last_entry_quantity: null,
    theoretical_stock: 0,
    min_stock: 5,
    sold_last_30_days: 0,
    days_left: null,
    status: "OUT_OF_STOCK",
    suggested_quantity: 10,
    ...over,
});

describe("SupplierOrder", () => {
    let fixture: ComponentFixture<SupplierOrder>;
    let el: HTMLElement;
    let getPurchaseOrder: ReturnType<typeof vi.fn>;

    async function render(
        alerts: LowStockAlert[],
        supplier: { telephone: string | null; contact?: string | null } = {
            telephone: "06 612 34 56",
            contact: "Mireille Mavoungou",
        },
    ) {
        getPurchaseOrder = vi.fn(() => of(new Blob(["%PDF"])));

        await TestBed.configureTestingModule({
            imports: [SupplierOrder],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: of(convertToParamMap({ id: "4" })) },
                },
                {
                    provide: LowStockAlertService,
                    useValue: {
                        getPurchaseOrder,
                        alerts: {
                            hasValue: () => true,
                            value: () => alerts,
                            error: () => undefined,
                            isLoading: () => false,
                        },
                    },
                },
                {
                    provide: SupplierService,
                    useValue: {
                        getSupplier: () =>
                            of({ id: 4, name: "Ets Ouédraogo", contact: null, ...supplier }),
                    },
                },
                {
                    provide: ShopSettingsService,
                    useValue: {
                        getSettings: () => of({ name: "Adam Ouédraogo" }),
                        defaultCountryCode: signal("242"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SupplierOrder);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const whatsapp = () => el.querySelector<HTMLAnchorElement>("a.whatsapp");
    const messageOf = (link: HTMLAnchorElement) => decodeURIComponent(link.href.split("?text=")[1]);

    it("should only list the products of this supplier, with the advised quantity", async () => {
        await render([alert({}), alert({ id: 2, name: "Pagne wax", supplier_id: 9 })]);

        expect(text()).toContain("Bazin riche bleu");
        expect(text()).not.toContain("Pagne wax");
        expect(el.querySelector<HTMLInputElement>(".stepper input")!.value).toBe("10");
    });

    it("should prepare the WhatsApp message with the products and quantities", async () => {
        await render([alert({}), alert({ id: 2, name: "Foulard", suggested_quantity: 6 })]);
        const link = whatsapp()!;
        const message = messageOf(link);

        expect(link.href).toContain("https://wa.me/242066123456?text=");
        expect(message).toContain("Bonjour Mireille Mavoungou,");
        expect(message).toContain("Ici la boutique Adam Ouédraogo.");
        expect(message).toContain("- Bazin riche bleu : 10");
        expect(message).toContain("- Foulard : 6");
    });

    it("should keep an international number as it is", async () => {
        await render([alert({})], { telephone: "+226 70 12 34 56" });

        expect(whatsapp()!.href).toContain("https://wa.me/22670123456?text=");
    });

    it("should follow the quantity and the checkbox in the message", async () => {
        await render([alert({}), alert({ id: 2, name: "Foulard", suggested_quantity: 6 })]);

        fixture.componentInstance.step(1, 5);
        fixture.componentInstance.toggle(2);
        await fixture.whenStable();
        const message = messageOf(whatsapp()!);

        expect(message).toContain("- Bazin riche bleu : 15");
        expect(message).not.toContain("Foulard");
    });

    it("should keep a hand-written message until a quantity changes", async () => {
        await render([alert({})]);

        fixture.componentInstance.editMessage("Bonjour, j'arrive demain.");
        await fixture.whenStable();
        expect(messageOf(whatsapp()!)).toBe("Bonjour, j'arrive demain.");

        fixture.componentInstance.step(1, 1);
        await fixture.whenStable();
        expect(messageOf(whatsapp()!)).toContain("- Bazin riche bleu : 11");
    });

    it("should never go below 1 and refuse an empty selection", async () => {
        await render([alert({})]);

        fixture.componentInstance.step(1, -50);
        expect(fixture.componentInstance.rows()[0].quantity).toBe(1);

        fixture.componentInstance.toggle(1);
        await fixture.whenStable();
        expect(whatsapp()).toBeNull();
        expect(text()).toContain("Choisissez au moins un produit.");
    });

    it("should explain when the supplier has no phone", async () => {
        await render([alert({})], { telephone: null });

        expect(whatsapp()).toBeNull();
        expect(el.querySelector<HTMLButtonElement>("button.whatsapp")!.disabled).toBe(true);
        expect(text()).toContain("Ajoutez le téléphone de ce fournisseur");
    });

    it("should say when there is nothing left to order", async () => {
        await render([]);

        expect(text()).toContain("Plus rien à commander chez ce fournisseur.");
    });

    it("should download the purchase order, and say when it fails", async () => {
        URL.createObjectURL = vi.fn(() => "blob:bon");
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        await render([alert({})]);

        fixture.componentInstance.downloadOrder("pdf");
        expect(getPurchaseOrder).toHaveBeenCalledWith(4, "pdf");
        expect(click).toHaveBeenCalled();

        getPurchaseOrder.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 500 })),
        );
        fixture.componentInstance.downloadOrder("pdf");
        await fixture.whenStable();
        expect(text()).toContain("Impossible de préparer le bon de commande.");
        click.mockRestore();
    });

    it("should copy the message", async () => {
        const writeText = vi.fn(() => Promise.resolve());
        Object.assign(navigator, { clipboard: { writeText } });
        await render([alert({})]);

        await fixture.componentInstance.copy();
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining("- Bazin riche bleu : 10"));
        expect(fixture.componentInstance.copied()).toBe(true);
    });
});

import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { SaleService } from "./sale.service";
import { API_URL } from "../api.config";

describe("SaleService", () => {
    let service: SaleService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(SaleService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should ask a page of sales with the summary and only the filters set", () => {
        service
            .getSalesPage({ status: "CANCELLED", from: "2026-11-05", to: null, page: 2, limit: 20 })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/sales`);
        expect(req.request.params.get("includeSummary")).toBe("true");
        expect(req.request.params.get("status")).toBe("CANCELLED");
        expect(req.request.params.get("from")).toBe("2026-11-05");
        expect(req.request.params.has("to")).toBe(false);
        expect(req.request.params.get("page")).toBe("2");
        req.flush({
            data: [],
            total: 0,
            counters: { all: 0, active: 0, cancelled: 0, active_total: 0 },
        });
    });

    it("should turn the amounts of a sale into numbers", () => {
        let unitPrice: number | undefined;
        service.getSale(6).subscribe((sale) => (unitPrice = sale.items[0].unit_price));

        httpMock.expectOne(`${API_URL}/sales/6`).flush({
            id: 6,
            total: "3000",
            items: [
                {
                    id: 1,
                    product_id: 3,
                    product_name: "Riz",
                    quantity: 2,
                    unit_price: "1500.00",
                    reference_price: "1500.00",
                    discount_amount: "0.00",
                },
            ],
        });

        expect(unitPrice).toBe(1500);
    });

    it("should send the items and the refund reason", () => {
        service.createSale([{ productId: 3, quantity: 2 }]).subscribe();
        const create = httpMock.expectOne(`${API_URL}/sales`);
        expect(create.request.method).toBe("POST");
        expect(create.request.body).toEqual({
            items: [{ productId: 3, quantity: 2 }],
            paymentMethod: "CASH",
        });
        create.flush({ id: 7 });

        service.cancelSale(7, "Erreur de saisie").subscribe();
        const cancel = httpMock.expectOne(`${API_URL}/sales/7/cancel`);
        expect(cancel.request.body).toEqual({ reason: "Erreur de saisie" });
        cancel.flush({ message: "ok" });
    });
});

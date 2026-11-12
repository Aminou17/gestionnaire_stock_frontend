import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { API_URL } from "../api.config";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
    let service: InventoryService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(InventoryService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should load the list of inventories", () => {
        service.getInventories().subscribe();
        httpMock.expectOne(`${API_URL}/inventories`).flush([]);
    });

    it("should send the counted products", () => {
        service.createInventory([{ productId: 3, actualStock: 26 }]).subscribe();

        const req = httpMock.expectOne(`${API_URL}/inventories`);
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ items: [{ productId: 3, actualStock: 26 }] });
        req.flush({ id: 11 });
    });

    it("should turn the purchase prices of a detail into numbers", () => {
        let prices: number[] = [];
        service.getInventory(10).subscribe((inventory) => {
            prices = inventory.items.map((item) => item.purchase_price);
        });

        httpMock.expectOne(`${API_URL}/inventories/10`).flush({
            id: 10,
            items: [{ id: 1, purchase_price: "2500.00" }],
        });
        expect(prices).toEqual([2500]);
    });
});

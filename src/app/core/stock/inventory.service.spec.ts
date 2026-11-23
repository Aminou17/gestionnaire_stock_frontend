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

    it("should list the inventories with the statuses joined and the page", () => {
        service
            .getInventories({
                statuses: ["in_progress", "counted"],
                search: "fin",
                page: 2,
                limit: 20,
            })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/inventories`);
        expect(req.request.params.get("status")).toBe("in_progress,counted");
        expect(req.request.params.get("search")).toBe("fin");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.get("limit")).toBe("20");
        req.flush({ data: [], pagination: {} });
    });

    it("should not send an empty status or search", () => {
        service.getInventories({ statuses: [], search: "", page: 1, limit: 20 }).subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/inventories`);
        expect(req.request.params.has("status")).toBe(false);
        expect(req.request.params.has("search")).toBe(false);
        req.flush({ data: [], pagination: {} });
    });

    it("should ask a page of lines with the filter and the search", () => {
        service
            .getInventory(7, { filter: "differences", search: "riz", page: 3, limit: 50 })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === `${API_URL}/inventories/7`);
        expect(req.request.params.get("filter")).toBe("differences");
        expect(req.request.params.get("search")).toBe("riz");
        expect(req.request.params.get("page")).toBe("3");
        req.flush({});
    });

    it("should open an inventory with its client key", () => {
        service.start({ name: "Fin de mois", clientKey: "abc" }).subscribe();

        const req = httpMock.expectOne(`${API_URL}/inventories`);
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ name: "Fin de mois", clientKey: "abc" });
        req.flush({});
    });

    it("should send a packet of counts and remove a product from the count", () => {
        service.saveItems(7, [{ productId: 3, actualStock: 26 }]).subscribe();
        const put = httpMock.expectOne(`${API_URL}/inventories/7/items`);
        expect(put.request.method).toBe("PUT");
        expect(put.request.body).toEqual({ items: [{ productId: 3, actualStock: 26 }] });
        put.flush({});

        service.removeItem(7, 3).subscribe();
        const del = httpMock.expectOne(`${API_URL}/inventories/7/items/3`);
        expect(del.request.method).toBe("DELETE");
        del.flush({});
    });

    it("should close the count without any option", () => {
        service.close(7).subscribe();

        const req = httpMock.expectOne(`${API_URL}/inventories/7/close`);
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({});
        req.flush({});
    });

    it("should call apply, cancel and movements since", () => {
        service.apply(7).subscribe();
        expect(httpMock.expectOne(`${API_URL}/inventories/7/apply`).request.method).toBe("POST");

        service.cancel(7).subscribe();
        expect(httpMock.expectOne(`${API_URL}/inventories/7/cancel`).request.method).toBe("POST");

        service.getMovementsSince(7).subscribe();
        expect(httpMock.expectOne(`${API_URL}/inventories/7/movements-since`).request.method).toBe(
            "GET",
        );
    });

    it("should download the exports as files", () => {
        service.exportList("csv").subscribe();
        const list = httpMock.expectOne((r) => r.url === `${API_URL}/inventories/export`);
        expect(list.request.params.get("format")).toBe("csv");
        expect(list.request.responseType).toBe("blob");
        list.flush(new Blob());

        service.exportInventory(7, "pdf").subscribe();
        const one = httpMock.expectOne((r) => r.url === `${API_URL}/inventories/7/export`);
        expect(one.request.params.get("format")).toBe("pdf");
        one.flush(new Blob());
    });
});

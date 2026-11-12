import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { ProductService } from "./product.service";
import { ProductFilters } from "./product.model";

const filters: ProductFilters = {
    search: "",
    categoryId: null,
    stockStatus: null,
    status: "active",
    page: 1,
    limit: 10,
};

describe("ProductService", () => {
    let service: ProductService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(ProductService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should not send the status for active products (refused to a manager)", () => {
        service.getProducts(filters).subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/products");
        expect(req.request.params.has("status")).toBe(false);
        expect(req.request.params.get("includeSummary")).toBe("true");
        req.flush({ data: [], total: 0, counters: {} });
    });

    it("should send the chosen filters", () => {
        service
            .getProducts({
                ...filters,
                categoryId: 3,
                stockStatus: "LOW",
                status: "deleted",
                page: 2,
            })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/products");
        expect(req.request.params.get("categoryId")).toBe("3");
        expect(req.request.params.get("stockStatus")).toBe("LOW");
        expect(req.request.params.get("status")).toBe("deleted");
        expect(req.request.params.get("page")).toBe("2");
        req.flush({ data: [], total: 0, counters: {} });
    });

    it("should convert the amounts sent as text by PostgreSQL", () => {
        let price = 0;
        service.getProducts(filters).subscribe((res) => (price = res.data[0].sale_price));

        httpMock
            .expectOne((r) => r.url === "/api/products")
            .flush({
                data: [{ id: 1, name: "Bazin", sale_price: "15000.00", max_discount: "0.00" }],
                total: 1,
                counters: {},
            });

        expect(price).toBe(15000);
    });

    it("should deactivate a product with DELETE", () => {
        service.deleteProduct(4).subscribe();
        expect(httpMock.expectOne("/api/products/4").request.method).toBe("DELETE");
    });
});

import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { CustomerService } from "./customer.service";

describe("CustomerService", () => {
    let httpMock: HttpTestingController;
    let service: CustomerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        httpMock = TestBed.inject(HttpTestingController);
        service = TestBed.inject(CustomerService);
    });

    afterEach(() => httpMock.verify());

    it("should load the first page without any extra parameter", () => {
        service.getCustomers().subscribe();
        httpMock.expectOne("/api/customers").flush({ rows: [], total: 0, page: 1, limit: 20 });
    });

    it("should send only the filters that differ from the defaults", () => {
        service
            .getCustomers({
                search: " adam ",
                status: "active",
                unpaid: true,
                sort: "spent",
                page: 2,
                limit: 20,
            })
            .subscribe();

        const req = httpMock.expectOne((r) => r.url === "/api/customers");
        expect(req.request.params.get("search")).toBe("adam");
        expect(req.request.params.get("unpaid")).toBe("true");
        expect(req.request.params.get("sort")).toBe("spent");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.has("status")).toBe(false);
        req.flush({ rows: [], total: 0, page: 2, limit: 20 });
    });

    it("should ask the inactive customers with status=inactive", () => {
        service.getCustomers({ status: "inactive" }).subscribe();
        httpMock
            .expectOne("/api/customers?status=inactive")
            .flush({ rows: [], total: 0, page: 1, limit: 20 });
    });

    it("should load one customer and his sales", () => {
        service.getCustomer(4).subscribe();
        httpMock.expectOne("/api/customers/4").flush({ id: 4 });

        service.getCustomerSales(4, 2, 10).subscribe();
        const req = httpMock.expectOne((r) => r.url === "/api/customers/4/sales");
        expect(req.request.params.get("page")).toBe("2");
        expect(req.request.params.get("limit")).toBe("10");
        req.flush({ rows: [], total: 0, page: 2, limit: 10 });
    });

    it("should create and update a customer", () => {
        const input = { name: "Adam", phone: "06 123 45 67", note: null };

        service.createCustomer(input).subscribe();
        const post = httpMock.expectOne("/api/customers");
        expect(post.request.method).toBe("POST");
        expect(post.request.body).toEqual(input);
        post.flush({ id: 5 });

        service.updateCustomer(5, input).subscribe();
        const put = httpMock.expectOne("/api/customers/5");
        expect(put.request.method).toBe("PUT");
        put.flush({ id: 5 });
    });

    it("should deactivate with DELETE and restore with PATCH", () => {
        service.deleteCustomer(5).subscribe();
        expect(httpMock.expectOne("/api/customers/5").request.method).toBe("DELETE");

        service.restoreCustomer(5).subscribe();
        const patch = httpMock.expectOne("/api/customers/5/restore");
        expect(patch.request.method).toBe("PATCH");
    });

    it("should post a payment to the customer", () => {
        service.payCustomer(7, { paymentMethod: "CASH", amountPaid: 2500 }).subscribe();

        const req = httpMock.expectOne("/api/customers/7/payments");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ paymentMethod: "CASH", amountPaid: 2500 });
        req.flush({ amount: 2500, remaining: 0, sales: [] });
    });

    it("should ask for the public ticket link of a payment", () => {
        service.getPaymentTicketLink(5).subscribe();

        const req = httpMock.expectOne("/api/tickets/customer-payments/5/link");
        expect(req.request.method).toBe("POST");
        req.flush({ url: "https://api.test/t/p5.abc" });
    });
});

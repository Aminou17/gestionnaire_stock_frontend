import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { SupplierService } from "./supplier.service";

describe("SupplierService", () => {
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should load the active suppliers", () => {
        TestBed.inject(SupplierService).getSuppliers().subscribe();
        httpMock.expectOne("/api/suppliers").flush([]);
    });

    it("should create a supplier with POST", () => {
        TestBed.inject(SupplierService)
            .createSupplier({ name: "Tissus du Faso", telephone: null })
            .subscribe();

        const req = httpMock.expectOne("/api/suppliers");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ name: "Tissus du Faso", telephone: null });
        req.flush({ id: 9, name: "Tissus du Faso", is_active: true });
    });

    it("should ask every supplier with status=all", () => {
        TestBed.inject(SupplierService).getSuppliers("all").subscribe();
        httpMock.expectOne("/api/suppliers?status=all").flush([]);
    });

    it("should load one supplier", () => {
        TestBed.inject(SupplierService).getSupplier(4).subscribe();
        httpMock.expectOne("/api/suppliers/4").flush({ id: 4 });
    });

    it("should update a supplier with PUT", () => {
        TestBed.inject(SupplierService)
            .updateSupplier(4, { name: "Faso Distribution" })
            .subscribe();

        const req = httpMock.expectOne("/api/suppliers/4");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual({ name: "Faso Distribution" });
        req.flush({ id: 4 });
    });

    it("should delete a supplier with DELETE", () => {
        TestBed.inject(SupplierService).deleteSupplier(4).subscribe();

        const req = httpMock.expectOne("/api/suppliers/4");
        expect(req.request.method).toBe("DELETE");
        req.flush({ message: "ok" });
    });
});

import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";

import { AuthService } from "../auth/auth.service";
import { NetworkService } from "./network.service";
import { OfflineCatalogService } from "./offline-catalog.service";
import { SaleOutboxService } from "./sale-outbox.service";

describe("SaleOutboxService", () => {
    let service: SaleOutboxService;
    let httpMock: HttpTestingController;
    const online = signal(false);
    const catalog = { takeStock: vi.fn(async () => {}), refresh: vi.fn(async () => {}) };

    const summary = {
        total: 15000,
        lines: [{ name: "Bazin riche", quantity: 2, unitPrice: 7500 }],
        customer: null,
        method: "CASH" as const,
    };

    beforeEach(() => {
        online.set(false);
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { user: () => ({ id: 3 }) } },
                { provide: NetworkService, useValue: { online } },
                { provide: OfflineCatalogService, useValue: catalog },
            ],
        });
        service = TestBed.inject(SaleOutboxService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    // la mémoire de secours est partagée entre les tests : on la vide
    afterEach(async () => {
        for (const sale of service.pending()) await service.remove(sale.clientRef);
    });

    it("garde la vente sur l'appareil avec un identifiant unique et fait baisser le stock", async () => {
        const sale = await service.add(
            [{ productId: 1, quantity: 2 }],
            { paymentMethod: "CASH" },
            summary,
        );

        expect(sale.clientRef).toMatch(/^[0-9a-f-]{36}$/);
        expect(service.count()).toBe(1);
        expect(catalog.takeStock).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }]);
    });

    it("envoie la vente avec son identifiant et sa date, puis la retire", async () => {
        const sale = await service.add(
            [{ productId: 1, quantity: 2 }],
            { paymentMethod: "CASH" },
            summary,
        );

        const sync = service.sync();
        await Promise.resolve();
        await new Promise((r) => setTimeout(r));
        const req = httpMock.expectOne("/api/sales");
        expect(req.request.body.clientRef).toBe(sale.clientRef);
        expect(req.request.body.soldAt).toBe(sale.soldAt);
        req.flush({ id: 50 });
        await sync;

        expect(service.count()).toBe(0);
    });

    it("garde la vente quand le réseau est toujours absent", async () => {
        await service.add([{ productId: 1, quantity: 1 }], { paymentMethod: "CASH" }, summary);

        const sync = service.sync();
        await new Promise((r) => setTimeout(r));
        httpMock.expectOne("/api/sales").error(new ProgressEvent("error"), { status: 0 });
        await sync;

        expect(service.count()).toBe(1);
        expect(service.pending()[0].status).toBe("waiting");
    });

    it("marque une vente refusée à vérifier, et une caisse fermée à part", async () => {
        await service.add([{ productId: 1, quantity: 1 }], { paymentMethod: "CASH" }, summary);

        const sync = service.sync();
        await new Promise((r) => setTimeout(r));
        httpMock
            .expectOne("/api/sales")
            .flush(
                { code: "CASH_CLOSED", message: "Ouvrez votre caisse." },
                { status: 409, statusText: "Conflict" },
            );
        await sync;

        expect(service.pending()[0].status).toBe("cash");
        expect(service.needsAttention()).toBe(1);
    });
});

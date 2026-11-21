import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { of } from "rxjs";

import { AuthService } from "../auth/auth.service";
import { ProductService } from "../stock/product.service";
import { OfflineCatalogService } from "./offline-catalog.service";

describe("OfflineCatalogService", () => {
    let service: OfflineCatalogService;
    let httpMock: HttpTestingController;

    const products = [
        { id: 1, name: "A", theoretical_stock: 10 },
        { id: 2, name: "B", theoretical_stock: 4 },
    ];

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { user: () => ({ id: 77 }) } },
                {
                    provide: ProductService,
                    useValue: { getProducts: () => of({ data: products, total: 2 }) },
                },
            ],
        });
        service = TestBed.inject(OfflineCatalogService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    const refresh = async () => {
        const done = service.refresh();
        await new Promise((r) => setTimeout(r));
        httpMock.expectOne("/api/categories").flush([]);
        await done;
    };

    it("garde les produits et les retrouve au chargement suivant", async () => {
        await refresh();
        expect(service.products().length).toBe(2);

        const other = TestBed.runInInjectionContext(() => new OfflineCatalogService());
        await other.load();
        expect(other.products().map((p) => p.id)).toEqual([1, 2]);
    });

    it("retire du stock les ventes pas encore envoyées quand le catalogue est rechargé", async () => {
        service.registerPending(() => [
            { productId: 1, quantity: 3 },
            { productId: 1, quantity: 2 },
        ]);
        await refresh();

        expect(service.products().find((p) => p.id === 1)?.theoretical_stock).toBe(5);
        expect(service.products().find((p) => p.id === 2)?.theoretical_stock).toBe(4);
    });

    it("fait baisser le stock affiché à chaque vente hors ligne", async () => {
        await refresh();
        await service.takeStock([{ productId: 2, quantity: 1 }]);

        expect(service.products().find((p) => p.id === 2)?.theoretical_stock).toBe(3);
    });
});

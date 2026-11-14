import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { OwnedShop } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { Shops } from "./shops";

const shop = (overrides: Partial<OwnedShop> = {}): OwnedShop => ({
    id: 1,
    name: "Awa Bazin",
    status: "ACTIVE",
    created_at: "2026-11-01T10:00:00.000Z",
    admin_name: "Awa",
    admin_email: "awa@exemple.com",
    users_count: 8,
    sales_last_30_days: 28,
    last_sale_at: "2026-11-14T09:00:00.000Z",
    ...overrides,
});

describe("Shops", () => {
    let service: { getShops: any; setStatus: any; createShop: any };

    const render = async (shops: OwnedShop[]) => {
        service = {
            getShops: vi.fn(() => of(shops)),
            setStatus: vi.fn(() => of({})),
            createShop: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [Shops],
            providers: [{ provide: OwnerShopService, useValue: service }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Shops);
        await fixture.whenStable();
        return fixture;
    };

    beforeAll(() => {
        // jsdom n'implémente pas les fenêtres <dialog>
        HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
            this.open = true;
        };
        HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
            this.open = false;
        };
    });

    it("should list the shops with their activity and the totals", async () => {
        const fixture = await render([
            shop(),
            shop({ id: 2, name: "Chez Fatou", status: "SUSPENDED", sales_last_30_days: 2 }),
        ]);
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelectorAll(".shop").length).toBe(2);
        expect(el.querySelector(".head p")?.textContent).toContain("30 ventes");
        expect(el.querySelector(".kpis")?.textContent).toContain("Suspendues1");
        expect(el.textContent).toContain("awa@exemple.com");
        expect(el.querySelectorAll(".badge").length).toBe(1);
        expect(el.querySelector(".badge")?.textContent).toContain("Suspendue");
    });

    it("should filter the list with the summary tiles", async () => {
        const fixture = await render([
            shop(),
            shop({ id: 2, name: "Chez Fatou", status: "SUSPENDED" }),
        ]);
        const el = fixture.nativeElement as HTMLElement;

        (el.querySelectorAll(".kpi")[2] as HTMLButtonElement).click();
        await fixture.whenStable();

        const names = [...el.querySelectorAll(".shop strong")].map((e) => e.textContent);
        expect(names).toEqual(["Chez Fatou"]);
    });

    it("should filter by name, administrator or email", async () => {
        const fixture = await render([
            shop(),
            shop({ id: 2, name: "Chez Fatou", admin_email: "fatou@x.com" }),
        ]);
        fixture.componentInstance.search.set("fatou");
        await fixture.whenStable();

        const names = [...fixture.nativeElement.querySelectorAll(".shop strong")].map(
            (e: Element) => e.textContent,
        );
        expect(names).toEqual(["Chez Fatou"]);
    });

    it("should ask for confirmation before suspending a shop", async () => {
        const fixture = await render([shop()]);
        const el = fixture.nativeElement as HTMLElement;

        (el.querySelector(".more-btn") as HTMLButtonElement).click();
        await fixture.whenStable();
        (el.querySelector(".menu .danger") as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(service.setStatus).not.toHaveBeenCalled();
        expect(el.querySelector("#suspend-title")?.textContent).toContain("Suspendre Awa Bazin");

        fixture.componentInstance.confirmSuspend();
        expect(service.setStatus).toHaveBeenCalledWith(1, "SUSPENDED");
    });

    it("should reactivate a suspended shop in one click", async () => {
        const fixture = await render([shop({ status: "SUSPENDED" })]);
        (fixture.nativeElement.querySelector(".shop-status .btn") as HTMLButtonElement).click();
        expect(service.setStatus).toHaveBeenCalledWith(1, "ACTIVE");
    });

    it("should offer to retry when the list cannot be loaded", async () => {
        service = {
            getShops: vi.fn(() => throwError(() => new Error("x"))),
            setStatus: vi.fn(),
            createShop: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [Shops],
            providers: [{ provide: OwnerShopService, useValue: service }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Shops);
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain("Impossible de charger les boutiques");
        expect(fixture.nativeElement.querySelector(".kpis")?.textContent).toContain("–");
    });
});

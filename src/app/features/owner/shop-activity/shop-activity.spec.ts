import { registerLocaleData } from "@angular/common";
import localeFr from "@angular/common/locales/fr";
import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { OwnerShopService } from "../owner-shop.service";
import { ShopActivity } from "./shop-activity";

registerLocaleData(localeFr);

const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("ShopActivity", () => {
    let getShopUsage: ReturnType<typeof vi.fn>;

    const render = async (usage: unknown) => {
        getShopUsage = vi.fn(() => of(usage));
        await TestBed.configureTestingModule({
            imports: [ShopActivity],
            providers: [
                provideRouter([]),
                { provide: LOCALE_ID, useValue: "fr" },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ id: "5" }) } },
                },
                {
                    provide: OwnerShopService,
                    useValue: {
                        getShop: () => of({ id: 5, name: "Chez Fatou" }),
                        getShopUsage,
                        getMargins: () =>
                            of({
                                days: 14,
                                rows: [
                                    {
                                        shop_id: 5,
                                        name: "Chez Fatou",
                                        sales_count: 20,
                                        revenue: 200000,
                                        cost: 150000,
                                        margin: 50000,
                                        margin_rate: 25,
                                    },
                                ],
                            }),
                    },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(ShopActivity);
        await fixture.whenStable();
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    const usage = () => ({
        days: 14,
        daily: [{ shop_id: 5, day: isoToday(), views: 40, employee_views: 10 }],
        pages: [
            { page: "/sales/new", views: 24, employee_views: 10 },
            { page: "/dashboard", views: 10, employee_views: null },
            { page: "/customers/:id", views: 6, employee_views: null },
        ],
    });

    const text = (el: HTMLElement) => el.textContent!.replace(/\s/g, " ");

    it("should ask for the activity over 14 days first, and change the period on demand", async () => {
        const { fixture, el } = await render(usage());

        expect(getShopUsage).toHaveBeenCalledWith(5, 14);

        el.querySelectorAll<HTMLButtonElement>(".period")[2].click();
        await fixture.whenStable();

        expect(getShopUsage).toHaveBeenLastCalledWith(5, 30);
    });

    it("should sum the pages, the days of use, the employees' share and the margin", async () => {
        const { el } = await render(usage());

        expect(text(el)).toContain("Pages ouvertes40");
        expect(text(el)).toContain("1 sur 14");
        expect(text(el)).toContain("25 %");
        expect(text(el)).toContain("50 000 F");
    });

    it("should group the pages by section and name the most opened ones", async () => {
        const { el } = await render(usage());

        const sections = [...el.querySelectorAll(".sections li .name")].map((n) => n.textContent);
        expect(sections).toEqual(["Ventes", "Accueil", "Dettes et clients"]);
        expect(text(el)).toContain("Nouvelle vente");
        expect(text(el)).toContain("dont 10 vendeurs");
    });

    it("should list the pages that were never opened", async () => {
        const { el } = await render(usage());

        const chips = [...el.querySelectorAll(".chips li")].map((c) => c.textContent);
        expect(chips).toContain("Inventaires");
        expect(chips).toContain("Caisse");
        expect(chips).not.toContain("Nouvelle vente");
        expect(chips).not.toContain("Accueil");
    });

    it("should say so when nothing was opened", async () => {
        const { el } = await render({ days: 14, daily: [], pages: [] });

        expect(text(el)).toContain("Aucune page ouverte sur cette période");
    });
});

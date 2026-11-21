import { Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Observable, of, throwError } from "rxjs";

import { AdminSpace } from "./admin-space";
import { AuthService } from "../../core/auth/auth.service";
import { Balance } from "../../core/reports/report.model";
import { ReportService } from "../../core/reports/report.service";
import { PageHeader } from "../../layout/page-header/page-header";

// l'en-tête a ses propres dépendances (cloche, profil) : inutiles ici
@Component({ selector: "app-page-header", template: "" })
class PageHeaderStub {
    title = input("");
    subtitle = input("");
}

const balance = (overrides: Partial<Balance> = {}): Balance => ({
    stock: {
        date: "2026-11-21",
        products: 3,
        units: 14,
        purchaseValue: 6000,
        saleValue: 9500,
        potentialProfit: 3500,
        categories: [
            {
                categoryId: 1,
                categoryName: "Boissons",
                products: 3,
                units: 14,
                purchaseValue: 6000,
                saleValue: 9500,
            },
        ],
    },
    period: { from: "2026-11-21", to: "2026-11-21" },
    sales: { count: 2, revenue: 20000, cost: 12000, grossProfit: 8000 },
    expenses: { total: 3000, count: 1, categories: [{ category: "FOOD", count: 1, total: 3000 }] },
    netProfit: 5000,
    ...overrides,
});

describe("AdminSpace", () => {
    let fixture: ComponentFixture<AdminSpace>;
    let getBalance: ReturnType<typeof vi.fn>;

    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

    async function render(result: Observable<Balance>) {
        getBalance = vi.fn().mockReturnValue(result);

        await TestBed.configureTestingModule({
            imports: [AdminSpace],
            providers: [
                provideRouter([]),
                { provide: ReportService, useValue: { getBalance } },
                { provide: AuthService, useValue: { isAdmin: () => true, user: () => null } },
            ],
        })
            .overrideComponent(AdminSpace, {
                remove: { imports: [PageHeader] },
                add: { imports: [PageHeaderStub] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(AdminSpace);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    it("should ask for today by default and show the three blocks", async () => {
        await render(of(balance()));

        const query = getBalance.mock.calls[0][0];
        expect(query.date).toBe(query.from);
        expect(query.from).toBe(query.to);

        expect(text()).toContain("Stock disponible");
        expect(text()).toContain("Ventes");
        expect(text()).toContain("Dépenses");
        expect(text()).toContain("Bénéfice net");
    });

    it("should keep the details folded until asked", async () => {
        await render(of(balance()));
        const el: HTMLElement = fixture.nativeElement;

        expect(el.textContent).not.toContain("Coût d'achat des articles vendus");
        expect(el.querySelectorAll(".rows").length).toBe(0);

        el.querySelectorAll<HTMLButtonElement>(".fold").forEach((b) => b.click());
        await fixture.whenStable();

        expect(el.textContent).toContain("Coût d'achat des articles vendus");
        expect(el.textContent).toContain("Valeur calculée avec les prix");
    });

    it("should show a positive net profit in green", async () => {
        await render(of(balance()));

        const card = fixture.nativeElement.querySelector(".net") as HTMLElement;
        expect(card.getAttribute("data-tone")).toBe("success");
    });

    it("should show a negative net profit in red", async () => {
        await render(of(balance({ netProfit: -2500 })));

        const card = fixture.nativeElement.querySelector(".net") as HTMLElement;
        expect(card.getAttribute("data-tone")).toBe("danger");
        expect(card.querySelector(".net-value")?.classList.contains("negative")).toBe(true);
    });

    it("should say so when there is no expense", async () => {
        await render(of(balance({ expenses: { total: 0, count: 0, categories: [] } })));

        expect(text()).toContain("Aucune dépense sur cette période");
    });

    it("should reload with a longer range when a period pill is chosen", async () => {
        await render(of(balance()));

        const pills = [...fixture.nativeElement.querySelectorAll(".period")] as HTMLElement[];
        pills.find((p) => p.textContent?.includes("7 jours"))!.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const query = getBalance.mock.calls.at(-1)![0];
        expect(query.from < query.to).toBe(true);
    });

    it("should not call the API while custom dates are wrong", async () => {
        await render(of(balance()));
        const calls = getBalance.mock.calls.length;

        fixture.componentInstance.selectPeriod("custom");
        fixture.componentInstance.applyCustomRange("2026-11-10", "2026-11-01");
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.componentInstance.customError()).toContain("précéder");
        expect(getBalance.mock.calls.length).toBe(calls);
    });

    it("should ignore a future stock date", async () => {
        await render(of(balance()));
        const before = fixture.componentInstance.stockDate();

        fixture.componentInstance.changeStockDate("2999-01-01");

        expect(fixture.componentInstance.stockDate()).toBe(before);
    });

    it("should offer a retry on error", async () => {
        await render(throwError(() => new Error("boom")));

        expect(text()).toContain("Impossible de charger le bilan");
        expect(text()).toContain("Réessayer");
    });
});

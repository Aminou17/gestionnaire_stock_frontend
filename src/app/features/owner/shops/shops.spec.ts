import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { OwnedShop } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { Shops } from "./shops";

const shop = (overrides: Partial<OwnedShop> = {}): OwnedShop => ({
    id: 1,
    name: "Awa Bazin",
    status: "ACTIVE",
    created_at: "2026-11-01T10:00:00.000Z",
    trial_ends_at: null,
    admin_name: "Awa",
    admin_email: "awa@exemple.com",
    users_count: 8,
    sales_last_30_days: 28,
    last_sale_at: "2026-11-14T09:00:00.000Z",
    ...overrides,
});

describe("Shops", () => {
    let service: { getShops: any; setStatus: any; setTrial: any; createShop: any };

    const render = async (shops: OwnedShop[]) => {
        service = {
            getShops: vi.fn(() => of(shops)),
            setStatus: vi.fn(() => of({})),
            setTrial: vi.fn(() => of({})),
            createShop: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [Shops],
            providers: [provideRouter([]), { provide: OwnerShopService, useValue: service }],
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

    const inDays = (days: number) =>
        new Date(Date.now() + days * 86_400_000 - 3_600_000).toISOString();

    it("should show the days left of the trial", async () => {
        const fixture = await render([shop({ trial_ends_at: inDays(12) })]);
        const label = fixture.nativeElement.querySelector(".trial");

        expect(label.textContent).toContain("Essai : 12 jours restants");
        expect(label.classList.contains("ended")).toBe(false);
    });

    it("should say when the trial is over", async () => {
        const fixture = await render([shop({ trial_ends_at: inDays(-3) })]);
        const label = fixture.nativeElement.querySelector(".trial");

        expect(label.textContent).toContain("Essai terminé");
        expect(label.classList.contains("ended")).toBe(true);
    });

    it("should show nothing when the shop has no trial", async () => {
        const fixture = await render([shop({ trial_ends_at: null })]);

        expect(fixture.nativeElement.querySelector(".trial")).toBeNull();
    });

    it("should open the trial dialog from the menu", async () => {
        const fixture = await render([shop()]);
        const el = fixture.nativeElement as HTMLElement;

        (el.querySelector(".more-btn") as HTMLButtonElement).click();
        await fixture.whenStable();
        const trialItem = Array.from(el.querySelectorAll<HTMLButtonElement>(".menu button")).find(
            (b) => b.textContent?.includes("Modifier l'essai"),
        );
        trialItem!.click();
        await fixture.whenStable();

        expect(el.querySelector(".menu")).toBeNull();
        expect(el.querySelector("#trial-title")?.textContent).toContain("Essai de Awa Bazin");
        expect(fixture.componentInstance.trialShop()?.id).toBe(1);
    });

    it("should send the number of days typed", async () => {
        const fixture = await render([shop()]);
        fixture.componentInstance.askTrial(shop());
        fixture.componentInstance.trialDays.set(45);

        fixture.componentInstance.saveTrial();

        expect(service.setTrial).toHaveBeenCalledWith(1, 45);
    });

    it("should accept the limits 1 and 365", async () => {
        const fixture = await render([shop()]);

        for (const days of [1, 365]) {
            fixture.componentInstance.askTrial(shop());
            fixture.componentInstance.trialDays.set(days);
            fixture.componentInstance.saveTrial();
            expect(service.setTrial).toHaveBeenLastCalledWith(1, days);
        }

        expect(fixture.componentInstance.trialError()).toBeNull();
    });

    it("should send null to remove the trial when the field is empty", async () => {
        const fixture = await render([shop()]);
        fixture.componentInstance.askTrial(shop());

        fixture.componentInstance.saveTrial();

        expect(service.setTrial).toHaveBeenCalledWith(1, null);
    });

    it("should refuse a number of days outside 1 to 365 without calling the API", async () => {
        const fixture = await render([shop()]);
        fixture.componentInstance.askTrial(shop());

        for (const days of [0, 366, -5, 1.5]) {
            fixture.componentInstance.trialDays.set(days);
            fixture.componentInstance.saveTrial();

            expect(fixture.componentInstance.trialError()).toContain("entre 1 et 365");
        }

        expect(service.setTrial).not.toHaveBeenCalled();
    });

    it("should show the message of the API when the trial cannot be changed", async () => {
        const fixture = await render([shop()]);
        service.setTrial.mockReturnValue(
            throwError(() => ({
                error: { message: "La durée d'essai doit être un nombre de jours entre 1 et 365." },
            })),
        );
        fixture.componentInstance.askTrial(shop());
        fixture.componentInstance.trialDays.set(30);

        fixture.componentInstance.saveTrial();
        await fixture.whenStable();

        expect(fixture.componentInstance.savingTrial()).toBe(false);
        expect(
            fixture.nativeElement.querySelector("dialog[aria-labelledby=trial-title] [role=alert]")
                ?.textContent,
        ).toContain("entre 1 et 365");
    });

    it("should reload the list after the trial is saved", async () => {
        const fixture = await render([shop()]);
        fixture.componentInstance.askTrial(shop());
        fixture.componentInstance.trialDays.set(30);

        fixture.componentInstance.saveTrial();
        await fixture.whenStable();

        expect(service.getShops).toHaveBeenCalledTimes(2);
    });

    it("should offer to retry when the list cannot be loaded", async () => {
        service = {
            getShops: vi.fn(() => throwError(() => new Error("x"))),
            setStatus: vi.fn(),
            setTrial: vi.fn(),
            createShop: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [Shops],
            providers: [provideRouter([]), { provide: OwnerShopService, useValue: service }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Shops);
        await fixture.whenStable();

        expect(fixture.nativeElement.textContent).toContain("Impossible de charger les boutiques");
        expect(fixture.nativeElement.querySelector(".kpis")?.textContent).toContain("–");
    });
});

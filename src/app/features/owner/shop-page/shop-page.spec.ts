import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { OwnedShopDetail } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { ShopPage } from "./shop-page";

const detail = (overrides: Partial<OwnedShopDetail> = {}): OwnedShopDetail => ({
    id: 5,
    name: "Chez Fatou",
    status: "ACTIVE",
    created_at: "2026-11-01T10:00:00.000Z",
    deleted_at: null,
    trial_ends_at: null,
    paid_until: null,
    access_ends_at: null,
    phone: "0102030405",
    address: "Rue 12, Abidjan",
    country: "Côte d'Ivoire",
    city: "Abidjan",
    tax_id: null,
    rccm: null,
    products_count: 42,
    customers_count: 15,
    suppliers_count: 4,
    sales_total: 310,
    last_login_at: "2026-11-13T09:00:00.000Z",
    sales_last_30_days: 28,
    last_sale_at: "2026-11-14T09:00:00.000Z",
    users: [
        {
            id: 7,
            name: "Fatou",
            email: "fatou@exemple.com",
            role: "admin",
            is_active: true,
            last_login_at: "2026-11-13T09:00:00.000Z",
            created_at: "2026-11-01T10:00:00.000Z",
        },
        {
            id: 8,
            name: "Moussa",
            email: "moussa@exemple.com",
            role: "manager",
            is_active: false,
            last_login_at: null,
            created_at: "2026-11-02T10:00:00.000Z",
        },
    ],
    ...overrides,
});

const httpError = (status: number, message: string) =>
    throwError(() => new HttpErrorResponse({ status, error: { message } }));

// le dernier formulaire de la carte est celui de l'essai (le premier règle le paiement)
const trialSave = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLFormElement>(".trial-form"))
        .at(-1)!
        .querySelector<HTMLButtonElement>("button[type=submit]")!;

describe("ShopPage", () => {
    let service: {
        getShop: ReturnType<typeof vi.fn>;
        sendResetLink: ReturnType<typeof vi.fn>;
        setTemporaryPassword: ReturnType<typeof vi.fn>;
        setTrial: ReturnType<typeof vi.fn>;
        setPaidUntil: ReturnType<typeof vi.fn>;
        setStatus: ReturnType<typeof vi.fn>;
        deleteShop: ReturnType<typeof vi.fn>;
        restoreShop: ReturnType<typeof vi.fn>;
    };

    const render = async (shop: OwnedShopDetail = detail()) => {
        service = {
            getShop: vi.fn(() => of(shop)),
            sendResetLink: vi.fn(() =>
                of({ message: "Un lien a été envoyé à fatou@exemple.com." }),
            ),
            setTemporaryPassword: vi.fn(() =>
                of({
                    user: { id: 7, name: "Fatou", email: "fatou@exemple.com" },
                    password: "Abcdefgh2345",
                }),
            ),
            setTrial: vi.fn(() => of({})),
            setPaidUntil: vi.fn(() => of({})),
            setStatus: vi.fn(() => of({})),
            deleteShop: vi.fn(() => of({})),
            restoreShop: vi.fn(() => of({})),
        };
        await TestBed.configureTestingModule({
            imports: [ShopPage],
            providers: [
                provideRouter([{ path: "owner/shops", children: [] }]),
                { provide: OwnerShopService, useValue: service },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ id: "5" }) } },
                },
            ],
        }).compileComponents();
        const fixture = TestBed.createComponent(ShopPage);
        await fixture.whenStable();
        return fixture;
    };

    const button = (el: HTMLElement, text: string) =>
        [...el.querySelectorAll("button")].find((b) =>
            b.textContent?.includes(text),
        ) as HTMLButtonElement;

    beforeAll(() => {
        // jsdom n'implémente pas les fenêtres <dialog> ; d'autres specs posent une version sans événement close, on impose la nôtre
        HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
            this.open = true;
        };
        HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
            this.open = false;
            this.dispatchEvent(new Event("close"));
        };
    });

    it("should show the summary and the accounts, never an amount", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.textContent).toContain("Chez Fatou");
        expect(el.textContent).toContain("Rue 12, Abidjan");
        expect(el.textContent).toContain("42");
        expect(el.textContent).toContain("fatou@exemple.com");
        expect(el.textContent).toContain("moussa@exemple.com");
        expect(el.textContent).toContain("supprimé");
        expect(el.textContent).toContain("Clients");
        expect(el.textContent).toContain("310");
        expect(el.textContent).not.toMatch(/FCFA|XOF|€|\$|chiffre d'affaires/i);
    });

    it("should offer the password actions only for active accounts", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelectorAll(".account-actions").length).toBe(1);
    });

    it("should call sendResetLink with the account id and show the success message", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        button(el, "Lien par e-mail").click();
        await fixture.whenStable();

        expect(service.sendResetLink).toHaveBeenCalledWith(5, 7);
        expect(el.querySelector(".alert-success")?.textContent).toContain(
            "Un lien a été envoyé à fatou@exemple.com.",
        );
    });

    it("should show the error when the link cannot be sent", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        service.sendResetLink.mockReturnValue(
            httpError(503, "L'envoi d'e-mails n'est pas configuré."),
        );

        button(el, "Lien par e-mail").click();
        await fixture.whenStable();

        expect(el.querySelector(".alert-error")?.textContent).toContain(
            "L'envoi d'e-mails n'est pas configuré.",
        );
    });

    it("should ask for confirmation before creating a temporary password", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        button(el, "Mot de passe provisoire").click();
        await fixture.whenStable();

        expect(service.setTemporaryPassword).not.toHaveBeenCalled();
        expect(el.querySelector("#temp-title")?.textContent).toContain(
            "Donner un mot de passe provisoire ?",
        );
        expect(el.textContent).not.toContain("Abcdefgh2345");
    });

    it("should show the temporary password once, then clear it when the dialog closes", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        button(el, "Mot de passe provisoire").click();
        await fixture.whenStable();
        button(el, "Créer le mot de passe").click();
        await fixture.whenStable();

        expect(service.setTemporaryPassword).toHaveBeenCalledWith(5, 7);
        expect(el.querySelector(".credentials")?.textContent).toContain("Abcdefgh2345");

        button(el, "Fermer").click();
        await fixture.whenStable();

        expect(fixture.componentInstance.tempPassword()).toBeNull();
        expect(el.textContent).not.toContain("Abcdefgh2345");
    });

    it("should show the error of the temporary password in the dialog", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        service.setTemporaryPassword.mockReturnValue(
            httpError(404, "Compte introuvable dans cette boutique."),
        );

        button(el, "Mot de passe provisoire").click();
        await fixture.whenStable();
        button(el, "Créer le mot de passe").click();
        await fixture.whenStable();

        expect(el.querySelector("dialog .alert-error")?.textContent).toContain(
            "Compte introuvable dans cette boutique.",
        );
        expect(fixture.componentInstance.tempPassword()).toBeNull();
    });

    it("should send null when the trial field is empty", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        fixture.componentInstance.trialDays.set(null);
        trialSave(el).click();
        await fixture.whenStable();

        expect(service.setTrial).toHaveBeenCalledWith(5, null);
        expect(el.textContent).toContain("Essai retiré.");
    });

    it("should send the number of days when it is between 1 and 365", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        for (const days of [1, 365]) {
            fixture.componentInstance.trialDays.set(days);
            trialSave(el).click();
            await fixture.whenStable();

            expect(service.setTrial).toHaveBeenLastCalledWith(5, days);
        }
    });

    it("should refuse a trial outside 1 to 365 days without calling the API", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        for (const days of [0, -5, 366, 2.5]) {
            fixture.componentInstance.trialDays.set(days);
            trialSave(el).click();
            await fixture.whenStable();
        }

        expect(service.setTrial).not.toHaveBeenCalled();
        expect(el.querySelector(".alert-error")?.textContent).toContain("entre 1 et 365");
    });

    it("should ask for confirmation before suspending the shop", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        button(el, "Suspendre").click();
        await fixture.whenStable();

        expect(service.setStatus).not.toHaveBeenCalled();
        expect(
            el.querySelector<HTMLDialogElement>("dialog[aria-labelledby='suspend-title']")?.open,
        ).toBe(true);

        el.querySelector<HTMLButtonElement>(
            "dialog[aria-labelledby='suspend-title'] button[type='submit']",
        )!.click();
        await fixture.whenStable();

        expect(service.setStatus).toHaveBeenCalledWith(5, "SUSPENDED");
    });

    it("should ask for confirmation before deleting the shop", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        button(el, "Supprimer").click();
        await fixture.whenStable();
        expect(service.deleteShop).not.toHaveBeenCalled();

        el.querySelector<HTMLButtonElement>(
            "dialog[aria-labelledby='delete-title'] button[type='submit']",
        )!.click();
        await fixture.whenStable();

        expect(service.deleteShop).toHaveBeenCalledWith(5);
    });

    it("should offer to restore a deleted shop and hide the subscription block", async () => {
        const fixture = await render(
            detail({ status: "SUSPENDED", deleted_at: new Date().toISOString() }),
        );
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelector(".trial-form")).toBeNull();
        expect(el.querySelectorAll(".account-actions").length).toBe(0);

        button(el, "Restaurer").click();
        expect(service.restoreShop).toHaveBeenCalledWith(5);
    });

    it("should extend the paid date by one month from today", async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        const chip = Array.from(el.querySelectorAll<HTMLButtonElement>(".chip")).find((b) =>
            b.textContent?.includes("1 mois"),
        )!;
        chip.click();
        await fixture.whenStable();

        const expected = new Date();
        expected.setMonth(expected.getMonth() + 1);
        expect(fixture.componentInstance.paidUntil().slice(0, 7)).toBe(
            expected.toISOString().slice(0, 7),
        );

        const chosen = fixture.componentInstance.paidUntil();
        el.querySelector<HTMLButtonElement>(".paid button[type=submit]")!.click();
        await fixture.whenStable();

        expect(service.setPaidUntil).toHaveBeenCalledWith(5, chosen);
        expect(el.textContent).toContain("Accès payé jusqu'au");
    });
});

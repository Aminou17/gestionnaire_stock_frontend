import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { Sidebar } from "./sidebar";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

describe("Sidebar", () => {
    const logoutAsked = signal(false);

    beforeEach(() => {
        localStorage.removeItem("sidebarCollapsed");
    });

    let el: HTMLElement;
    let stable: () => Promise<unknown>;

    async function render(isAdmin: boolean, alertCount = 0) {
        await TestBed.configureTestingModule({
            imports: [Sidebar],
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(isAdmin),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Yabre Moussa", email: "y@test.com" }),
                        roleLabel: signal(isAdmin ? "Administrateur" : "Employé"),
                        logoutAsked,
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(alertCount) } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Sidebar);
        await fixture.whenStable();
        el = fixture.nativeElement as HTMLElement;
        stable = () => fixture.whenStable();
        return el;
    }

    const labels = (el: HTMLElement) =>
        [...el.querySelectorAll("nav a > span:not(.count)")].map((s) => s.textContent);

    it("should show every page to the admin with the alert count", async () => {
        const el = await render(true, 5);

        expect(labels(el)).toContain("Utilisateurs");
        expect(el.querySelector(".count")?.textContent).toBe("5");
    });

    it("should hide admin-only pages from the manager", async () => {
        const el = await render(false);

        expect(labels(el)).toEqual([
            "Accueil",
            "Ventes",
            "Clients",
            "Caisse",
            "Produits",
            "Historique du stock",
            "Catégories",
            "Meilleures ventes",
            "Stock faible",
        ]);
    });

    it("should list every page flat, with no foldable group", async () => {
        const el = await render(true, 2);

        expect(el.querySelector("button.group")).toBeNull();
        expect(labels(el)).toEqual([
            "Accueil",
            "Ventes",
            "Clients",
            "Caisse",
            "Produits",
            "Historique du stock",
            "Corriger le stock",
            "Inventaire",
            "Catégories",
            "Meilleures ventes",
            "Entrées de stock",
            "Fournisseurs",
            "Stock faible",
            "Utilisateurs",
            "Historique des actions",
        ]);
        // l'ajustement du stock passe par la page Produits
        const adjust = [...el.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) =>
            a.textContent?.includes("Corriger le stock"),
        )!;
        expect(adjust.getAttribute("href")).toBe("/products?adjust=1");
    });

    it("should show Settings to everyone and Subscription and help links to the admin", async () => {
        const admin = await render(true);
        const links = (el: HTMLElement) =>
            [...el.querySelectorAll<HTMLAnchorElement>(".secondary a")].map((a) =>
                a.getAttribute("href"),
            );

        expect(links(admin)).toEqual([
            "/settings",
            "/subscription",
            "/contact",
            "/privacy",
            "/terms",
        ]);
    });

    it("should hide Subscription from the manager", async () => {
        const el = await render(false);

        expect(el.querySelector(".secondary a[href='/subscription']")).toBeNull();
        expect(el.querySelector(".secondary a[href='/settings']")).not.toBeNull();
    });

    it("should show the default picture, the name and the role in the profile", async () => {
        const el = await render(true);

        expect(el.querySelector(".avatar img")?.getAttribute("src")).toBe("/avatar-default.png");
        expect(el.querySelector(".who strong")?.textContent).toBe("Yabre Moussa");
        expect(el.querySelector(".who small")?.textContent).toBe("Administrateur");
    });

    it("should open the profile menu, log out, and close the menu on an outside click", async () => {
        const el = await render(true);

        el.querySelector<HTMLButtonElement>(".profile-btn")!.click();
        await stable();
        expect(el.querySelector(".popup")).not.toBeNull();

        document.body.click();
        await stable();
        expect(el.querySelector(".popup")).toBeNull();

        el.querySelector<HTMLButtonElement>(".profile-btn")!.click();
        await stable();
        el.querySelector<HTMLButtonElement>(".popup .logout")!.click();
        // un seul clic ne déconnecte pas : il ouvre la confirmation
        expect(logoutAsked()).toBe(true);
    });

    it("should collapse the menu and remember the choice", async () => {
        const el = await render(true);
        const aside = el.querySelector("aside")!;
        expect(aside.classList).not.toContain("collapsed");

        el.querySelector<HTMLButtonElement>(".collapse")!.click();
        await stable();

        expect(aside.classList).toContain("collapsed");
        expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
        expect(el.querySelector("nav a")?.getAttribute("title")).toBe("Accueil");
    });
});

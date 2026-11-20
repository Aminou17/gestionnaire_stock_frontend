import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { Sidebar } from "./sidebar";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { InstallService } from "../../core/pwa/install.service";

describe("Sidebar", () => {
    const logoutAsked = signal(false);

    beforeEach(() => {
        localStorage.removeItem("sidebarCollapsed");
    });

    let el: HTMLElement;
    let stable: () => Promise<unknown>;

    async function render(isAdmin: boolean, alertCount = 0, pwa?: object) {
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
                ...(pwa ? [{ provide: InstallService, useValue: pwa }] : []),
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
            "Catégories",
            "Historique du stock",
            "Alertes de stock",
            "Rotation des produits",
        ]);
    });

    it("should group the pages under Stock and Équipe", async () => {
        const el = await render(true, 2);

        const groups = [...el.querySelectorAll("button.group .label")].map((g) => g.textContent);

        expect(groups).toEqual(["Stock", "Équipe"]);
        expect(labels(el)).toEqual([
            "Accueil",
            "Ventes",
            "Clients",
            "Caisse",
            "Dépenses",
            "Produits",
            "Catégories",
            "Inventaires",
            "Corriger le stock",
            "Historique du stock",
            "Alertes de stock",
            "Rotation des produits",
            "Entrées de stock",
            "Fournisseurs",
            "Utilisateurs",
            "Historique des actions",
        ]);
        // l'ajustement du stock passe par la page Produits
        const adjust = [...el.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) =>
            a.textContent?.includes("Corriger le stock"),
        )!;
        expect(adjust.getAttribute("href")).toBe("/products?adjust=1");
    });

    it("should show the pages of a group as tiles in a window, and close it", async () => {
        const el = await render(true, 3);
        const group = el.querySelector<HTMLButtonElement>("button.group")!;
        expect(el.querySelector(".tiles")).toBeNull();

        group.click();
        await stable();

        const tiles = [...el.querySelectorAll(".tile .tile-label")].map((t) => t.textContent);
        expect(tiles).toEqual([
            "Produits",
            "Catégories",
            "Inventaires",
            "Corriger le stock",
            "Historique du stock",
            "Alertes de stock",
            "Rotation des produits",
            "Entrées de stock",
            "Fournisseurs",
        ]);
        expect(el.querySelector(".launcher h2")?.textContent).toContain("Stock");
        expect(el.querySelector(".tile .count")?.textContent).toBe("3");

        el.querySelector<HTMLButtonElement>(".launcher-close")!.click();
        await stable();

        expect(el.querySelector(".tiles")).toBeNull();
    });

    it("should go back to the menu after choosing a tile", async () => {
        const el = await render(true);
        el.querySelector<HTMLButtonElement>("button.group")!.click();
        await stable();

        // clic avec Ctrl : le lien ne navigue pas, le menu doit quand même se refermer
        el.querySelector(".tile")!.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }),
        );
        await stable();

        expect(el.querySelector(".tiles")).toBeNull();
    });

    it("should not repeat the alert count on the closed Stock group", async () => {
        const el = await render(true, 4);

        expect(el.querySelector("button.group .count")).toBeNull();
    });

    it("should not show Équipe to the manager", async () => {
        const el = await render(false);

        const groups = [...el.querySelectorAll("button.group .label")].map((g) => g.textContent);

        expect(groups).toEqual(["Stock"]);
    });

    it("should show only Settings at the bottom, for everyone", async () => {
        const admin = await render(true);
        const links = [...admin.querySelectorAll<HTMLAnchorElement>(".secondary a")].map((a) =>
            a.getAttribute("href"),
        );

        expect(links).toEqual(["/settings"]);
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

    it("should offer to install the app from the profile menu", async () => {
        const install = vi.fn();
        const el = await render(true, 0, { available: true, canInstall: () => true, install });

        el.querySelector<HTMLButtonElement>(".profile-btn")!.click();
        await stable();
        const item = [...el.querySelectorAll<HTMLButtonElement>(".popup button")].find((b) =>
            b.textContent?.includes("Installer"),
        );
        item!.click();
        await stable();

        expect(install).toHaveBeenCalled();
        expect(el.querySelector(".popup")).toBeNull();
    });

    it("should not offer to install when the app is already installed", async () => {
        const el = await render(true, 0, { available: false, canInstall: () => false });
        el.querySelector<HTMLButtonElement>(".profile-btn")!.click();
        await stable();
        expect(el.querySelector(".popup")?.textContent).not.toContain("Installer");
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

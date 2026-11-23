import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { Sidebar } from "./sidebar";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { InstallService } from "../../core/pwa/install.service";
import { ModuleStore } from "../../core/modules/module-access";

describe("Sidebar", () => {
    const logoutAsked = signal(false);

    beforeEach(() => {
        localStorage.removeItem("sidebarCollapsed");
    });

    let el: HTMLElement;
    let stable: () => Promise<unknown>;

    async function render(isAdmin: boolean, alertCount = 0, pwa?: object, lacking: string[] = []) {
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

        TestBed.inject(ModuleStore).disabled.set(lacking);

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

        expect(labels(el)).toContain("Employés");
        expect(el.querySelector(".count")?.textContent).toBe("5");
    });

    it("should keep a page the shop does not have in the menu, with a padlock", async () => {
        const el = await render(true, 0, undefined, ["team", "customers"]);

        expect(labels(el)).toContain("Employés");
        expect(labels(el)).toContain("Clients et crédits");
        const link = [...el.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) =>
            a.textContent?.includes("Employés"),
        )!;
        expect(link.querySelector("app-icon.lock")).not.toBeNull();
        const free = [...el.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) =>
            a.textContent?.includes("Ventes"),
        )!;
        expect(free.querySelector("app-icon.lock")).toBeNull();
    });

    it("should hide admin-only pages from the manager", async () => {
        const el = await render(false);

        expect(labels(el)).toEqual([
            "Accueil",
            "Ventes",
            "Clients et crédits",
            "Caisse",
            "Produits",
            "Catégories",
            "Inventaires",
            "Historique du stock",
            "Alertes de stock",
            "Vitesse de vente",
        ]);
    });

    it("should group the pages under Avancé", async () => {
        const el = await render(true, 2);

        const groups = [...el.querySelectorAll("button.group .label")].map((g) => g.textContent);

        expect(groups).toEqual(["Avancé"]);
        expect(labels(el)).toEqual([
            "Accueil",
            "Ventes",
            "Clients et crédits",
            "Caisse",
            "Dépenses",
            "Bilan",
            "Produits",
            "Catégories",
            "Inventaires",
            "Corriger la quantité",
            "Historique du stock",
            "Alertes de stock",
            "Vitesse de vente",
            "Entrées de stock",
            "Fournisseurs",
            "Employés",
            "Historique des actions",
        ]);
        // l'ajustement du stock passe par la page Produits
        const adjust = [...el.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) =>
            a.textContent?.includes("Corriger la quantité"),
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
            "Corriger la quantité",
            "Historique du stock",
            "Alertes de stock",
            "Vitesse de vente",
            "Entrées de stock",
            "Fournisseurs",
            "Employés",
            "Historique des actions",
        ]);
        expect(el.querySelector(".launcher h2")?.textContent).toContain("Avancé");
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

    it("should show the manager the Avancé group without the admin pages", async () => {
        const el = await render(false);

        const groups = [...el.querySelectorAll("button.group .label")].map((g) => g.textContent);

        expect(groups).toEqual(["Avancé"]);
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

    it("should keep the profile menu short", async () => {
        const el = await render(true, 0, { available: true, canInstall: () => true });
        el.querySelector<HTMLButtonElement>(".profile-btn")!.click();
        await stable();

        const items = [...el.querySelectorAll(".popup [role=menuitem]")].map((i) =>
            i.textContent?.trim(),
        );
        expect(items.some((i) => i?.startsWith("Mon profil"))).toBe(true);
        expect(items.join(" ")).not.toMatch(/Aide et contact|Mot de passe|Installer/);
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

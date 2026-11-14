import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { signal } from "@angular/core";

import { Sidebar } from "./sidebar";
import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

describe("Sidebar", () => {
    const logout = vi.fn();

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
                        logout,
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

        expect(labels(el)).toContain("Comptes");
        expect(el.querySelector(".count")?.textContent).toBe("5");
    });

    it("should offer a New sale button to every role", async () => {
        const el = await render(false);

        const button = el.querySelector<HTMLAnchorElement>("a.new-sale");
        expect(button?.textContent).toContain("Nouvelle vente");
        expect(button?.getAttribute("href")).toBe("/sales/new");
    });

    it("should hide admin-only pages from the manager", async () => {
        const el = await render(false);

        expect(labels(el)).toEqual([
            "Tableau de bord",
            "Ventes",
            "Caisse",
            "Produits",
            "Mouvements",
            "Catégories",
            "Rotation des produits",
            "Alertes",
        ]);
    });

    it("should group the restocking pages and open the group on click", async () => {
        const el = await render(true, 2);
        const group = [...el.querySelectorAll<HTMLButtonElement>("button.group")].find((b) =>
            b.textContent?.includes("Réapprovisionnement"),
        )!;
        expect(group.textContent).toContain("Réapprovisionnement");
        expect(el.querySelector(".children.shown")).toBeNull();
        // le nombre d'alertes n'apparaît que sur le groupe qui contient Alertes
        expect(el.querySelectorAll("button.group .count").length).toBe(1);

        group.click();
        await stable();

        const shown = el.querySelector(".children.shown")!;
        expect(shown.textContent).toContain("Entrées de stock");
        expect(shown.textContent).toContain("Fournisseurs");
        expect(shown.textContent).toContain("Alertes");
        // le nombre d'alertes passe de l'en-tête du groupe à la ligne Alertes
        expect(group.querySelector(".count")).toBeNull();
    });

    it("should show the manager Alertes alone and no Administration group", async () => {
        const el = await render(false);
        const groups = [...el.querySelectorAll("button.group")].map((b) => b.textContent?.trim());

        expect(groups).toEqual(["Stock"]);
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
        expect(logout).toHaveBeenCalled();
    });

    it("should collapse the menu and remember the choice", async () => {
        const el = await render(true);
        const aside = el.querySelector("aside")!;
        expect(aside.classList).not.toContain("collapsed");

        el.querySelector<HTMLButtonElement>(".collapse")!.click();
        await stable();

        expect(aside.classList).toContain("collapsed");
        expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
        expect(el.querySelector("nav a")?.getAttribute("title")).toBe("Tableau de bord");
    });
});

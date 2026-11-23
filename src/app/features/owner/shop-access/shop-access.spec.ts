import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { of } from "rxjs";

import { ShopModule } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { ShopAccess } from "./shop-access";

const module = (key: string, group: string, label: string, enabled = true): ShopModule => ({
    key,
    group,
    label,
    description: `${label} : explication`,
    enabled,
});

describe("ShopAccess", () => {
    let setShopModules: ReturnType<typeof vi.fn>;

    // jsdom ne connaît pas showModal : on imite l'ouverture et la fermeture
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    });

    const render = async (modules: ShopModule[]) => {
        setShopModules = vi.fn(() => of({ core: [], modules }));
        await TestBed.configureTestingModule({
            imports: [ShopAccess],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ id: "5" }) } },
                },
                {
                    provide: OwnerShopService,
                    useValue: {
                        getShop: () => of({ id: 5, name: "Chez Fatou" }),
                        getShopModules: () =>
                            of({ core: ["Ventes et encaissements", "Caisse"], modules }),
                        setShopModules,
                    },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(ShopAccess);
        await fixture.whenStable();
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    const modules = () => [
        module("customers", "Vente", "Dettes et clients"),
        module("expenses", "Caisse", "Dépenses"),
        module("audit", "Gestion", "Historique des actions"),
    ];
    const switches = (el: HTMLElement) => [
        ...el.querySelectorAll<HTMLButtonElement>("button.switch"),
    ];
    const saveBar = (el: HTMLElement) => el.querySelector(".savebar")!;
    const saveButton = (el: HTMLElement) =>
        el.querySelector<HTMLButtonElement>(".save-actions .btn-primary")!;

    it("should show what is always included and every access grouped, with its explanation", async () => {
        const { el } = await render(modules());

        expect(el.textContent).toContain("Toujours inclus");
        expect(el.textContent).toContain("Ventes et encaissements");
        expect(el.querySelectorAll(".group").length).toBe(3);
        expect(el.textContent).toContain("Dettes et clients : explication");
        expect(switches(el).every((s) => s.getAttribute("aria-checked") === "true")).toBe(true);
        expect(saveBar(el).classList.contains("visible")).toBe(false);
    });

    it("should show the save bar once an access is unticked, and count what is left", async () => {
        const { fixture, el } = await render(modules());

        switches(el)[2].click();
        fixture.detectChanges();

        expect(switches(el)[2].getAttribute("aria-checked")).toBe("false");
        expect(saveBar(el).classList.contains("visible")).toBe(true);
        expect(el.querySelector(".count")!.textContent).toContain("2 accès sur 3");
    });

    it("should ask to confirm before taking an access away, listing it", async () => {
        const { fixture, el } = await render(modules());

        switches(el)[2].click();
        fixture.detectChanges();
        saveButton(el).click();

        const dialog = el.querySelector<HTMLDialogElement>("dialog")!;
        expect(dialog.open).toBe(true);
        expect(dialog.textContent).toContain("Retirer 1 accès à Chez Fatou");
        expect(dialog.textContent).toContain("Historique des actions");
        expect(setShopModules).not.toHaveBeenCalled();
    });

    it("should save the removed accesses once confirmed", async () => {
        const { fixture, el } = await render(modules());

        switches(el)[0].click();
        switches(el)[2].click();
        fixture.detectChanges();
        saveButton(el).click();
        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();
        await fixture.whenStable();

        expect(setShopModules).toHaveBeenCalledWith(5, ["customers", "audit"]);
    });

    it("should save straight away, without asking, when an access is given back", async () => {
        const { fixture, el } = await render([
            module("customers", "Vente", "Dettes et clients", false),
            module("expenses", "Caisse", "Dépenses"),
        ]);

        expect(switches(el)[0].getAttribute("aria-checked")).toBe("false");
        switches(el)[0].click();
        fixture.detectChanges();
        saveButton(el).click();
        await fixture.whenStable();

        expect(el.querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
        expect(setShopModules).toHaveBeenCalledWith(5, []);
    });

    it("should tick everything, or keep only the essentials", async () => {
        const { fixture, el } = await render([
            module("customers", "Vente", "Dettes et clients", false),
            module("expenses", "Caisse", "Dépenses"),
        ]);
        const [all, essentials] = [...el.querySelectorAll<HTMLButtonElement>(".quick .btn")];

        all.click();
        fixture.detectChanges();
        expect(switches(el).every((s) => s.getAttribute("aria-checked") === "true")).toBe(true);

        essentials.click();
        fixture.detectChanges();
        expect(switches(el).every((s) => s.getAttribute("aria-checked") === "false")).toBe(true);
    });

    it("should go back to the saved state when the changes are cancelled", async () => {
        const { fixture, el } = await render(modules());

        switches(el)[1].click();
        fixture.detectChanges();
        el.querySelector<HTMLButtonElement>(".save-actions .btn-outline")!.click();
        fixture.detectChanges();

        expect(switches(el)[1].getAttribute("aria-checked")).toBe("true");
        expect(saveBar(el).classList.contains("visible")).toBe(false);
    });
});

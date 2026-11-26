import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { ModuleStore } from "../../core/modules/module-access";
import { FeatureLocked } from "./feature-locked";

describe("FeatureLocked", () => {
    // Jsdom ne connaît pas showModal : on imite l'ouverture et la fermeture
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    });

    const render = async () => {
        await TestBed.configureTestingModule({
            imports: [FeatureLocked],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(FeatureLocked);
        await fixture.whenStable();
        const store = TestBed.inject(ModuleStore);
        const el = fixture.nativeElement as HTMLElement;
        const dialog = el.querySelector<HTMLDialogElement>("dialog")!;
        const show = async (key: "customers" | "audit") => {
            store.locked.set(key);
            fixture.detectChanges();
            await fixture.whenStable();
        };
        return { fixture, store, el, dialog, show };
    };

    it("should stay closed until a function is tried without having it", async () => {
        const { dialog } = await render();

        expect(dialog.open).toBe(false);
    });

    it("should say, professionally, that the function comes with the subscription", async () => {
        const { dialog, show } = await render();

        await show("customers");

        expect(dialog.open).toBe(true);
        expect(dialog.textContent).toContain("Clients et crédits");
        expect(dialog.textContent).toContain("Disponible avec l'abonnement");
        expect(dialog.textContent).toContain("ne fait pas partie de votre formule actuelle");
        expect(dialog.textContent).toContain("contactez-nous");
    });

    it("should point to the contact page while the subscriptions are not open", async () => {
        const { el, show } = await render();

        await show("audit");

        const link = el.querySelector<HTMLAnchorElement>(".actions a")!;
        expect(link.textContent).toContain("Nous contacter");
        expect(link.getAttribute("href")).toBe("/contact");
    });

    it("should point to the Abonnement page once the owner has opened the subscriptions", async () => {
        const { el, store, show } = await render();
        store.subscriptions.set(true);

        await show("audit");

        const link = el.querySelector<HTMLAnchorElement>(".actions a")!;
        expect(link.textContent).toContain("Voir l'abonnement");
        expect(link.getAttribute("href")).toBe("/subscription");
    });

    it("should forget the function when it is closed", async () => {
        const { el, store, show } = await render();
        await show("audit");

        el.querySelector<HTMLButtonElement>(".actions .btn-outline")!.click();

        expect(store.locked()).toBeNull();
    });
});

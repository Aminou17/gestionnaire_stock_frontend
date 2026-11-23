import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { OwnerShopService } from "../owner-shop.service";
import { SubscriptionsSwitch } from "./subscriptions-switch";

describe("SubscriptionsSwitch", () => {
    let enabled: boolean;

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

    let setSubscriptions: ReturnType<typeof vi.fn>;

    const render = async (startEnabled = false) => {
        enabled = startEnabled;
        setSubscriptions = vi.fn((value: boolean) => {
            enabled = value;
            return of({ enabled, changedAt: "2026-12-01T10:00:00.000Z" });
        });
        await TestBed.configureTestingModule({
            imports: [SubscriptionsSwitch],
            providers: [
                {
                    provide: OwnerShopService,
                    useValue: {
                        getSubscriptions: () =>
                            of({ enabled, changedAt: enabled ? "2026-12-01T10:00:00.000Z" : null }),
                        setSubscriptions,
                    },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(SubscriptionsSwitch);
        await fixture.whenStable();
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    const mainButton = (el: HTMLElement) =>
        el.querySelector<HTMLButtonElement>(".panel-head .btn")!;
    const dialog = (el: HTMLElement) => el.querySelector<HTMLDialogElement>("dialog")!;

    it("should say the software is free while the subscriptions are off", async () => {
        const { el } = await render();

        expect(el.textContent).toContain("tout est gratuit");
        expect(mainButton(el).textContent).toContain("Activer");
    });

    it("should ask to confirm before activating, and change nothing yet", async () => {
        const { el } = await render();

        mainButton(el).click();

        expect(dialog(el).open).toBe(true);
        expect(el.querySelector("dialog")!.textContent).toContain("Activer les abonnements ?");
        expect(el.querySelector("dialog")!.textContent).toContain("prévenu vos clients");
        expect(setSubscriptions).not.toHaveBeenCalled();
    });

    it("should leave everything as it was when the owner cancels", async () => {
        const { el } = await render();

        mainButton(el).click();
        el.querySelector<HTMLButtonElement>("dialog .btn-outline")!.click();

        expect(dialog(el).open).toBe(false);
        expect(setSubscriptions).not.toHaveBeenCalled();
    });

    it("should activate once confirmed, then offer to turn them off again", async () => {
        const { fixture, el } = await render();

        mainButton(el).click();
        el.querySelector<HTMLButtonElement>("dialog .btn-primary")!.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(setSubscriptions).toHaveBeenCalledWith(true);
        expect(el.textContent).toContain("Les abonnements sont activés");
        expect(el.textContent).toContain("Activés");
        expect(mainButton(el).textContent).toContain("Désactiver");
    });

    it("should ask to confirm too before turning them off", async () => {
        const { fixture, el } = await render(true);

        mainButton(el).click();
        expect(el.querySelector("dialog")!.textContent).toContain("Désactiver les abonnements ?");

        el.querySelector<HTMLButtonElement>("dialog .btn-danger")!.click();
        await fixture.whenStable();

        expect(setSubscriptions).toHaveBeenCalledWith(false);
    });
});

import { TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";

import { AuthService } from "../../core/auth/auth.service";
import { SaleOutboxService } from "../../core/offline/sale-outbox.service";
import { LogoutDialog } from "./logout-dialog";

describe("LogoutDialog", () => {
    const logout = vi.fn();
    const logoutAsked = signal(false);
    const pending = signal(0);

    // Jsdom ne connaît pas showModal : on imite l'ouverture et l'évènement close
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    });

    async function render() {
        logout.mockClear();
        logoutAsked.set(false);
        pending.set(0);
        await TestBed.configureTestingModule({
            imports: [LogoutDialog],
            providers: [
                { provide: AuthService, useValue: { logout, logoutAsked } },
                { provide: SaleOutboxService, useValue: { count: pending } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(LogoutDialog);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    it("should stay closed until a logout is asked", async () => {
        const el = await render();
        expect(el.querySelector("dialog")!.open).toBe(false);
    });

    it("should open on request and log out only after the confirmation", async () => {
        const el = await render();
        logoutAsked.set(true);
        TestBed.tick();

        expect(el.querySelector("dialog")!.open).toBe(true);
        expect(logout).not.toHaveBeenCalled();

        el.querySelector<HTMLButtonElement>(".btn-danger")!.click();
        expect(logout).toHaveBeenCalled();
    });

    it("should close without logging out on Rester connecté", async () => {
        const el = await render();
        logoutAsked.set(true);
        TestBed.tick();

        el.querySelector<HTMLButtonElement>(".btn-outline")!.click();
        TestBed.tick();

        expect(logoutAsked()).toBe(false);
        expect(el.querySelector("dialog")!.open).toBe(false);
        expect(logout).not.toHaveBeenCalled();
    });

    it("prévient quand des ventes faites sans internet attendent encore", async () => {
        const el = await render();
        pending.set(2);
        logoutAsked.set(true);
        TestBed.tick();

        expect(el.textContent).toContain("2 ventes faites sans internet attendent");
    });
});

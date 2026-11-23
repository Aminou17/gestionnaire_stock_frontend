import { TestBed } from "@angular/core/testing";
import { Router, UrlTree } from "@angular/router";

import { ShopSettingsService } from "../shop/shop-settings.service";
import { ModuleStore } from "./module-access";
import { moduleGuard } from "./module.guard";

describe("moduleGuard", () => {
    let navigated: boolean;

    beforeEach(() => {
        navigated = true;
        TestBed.configureTestingModule({
            providers: [
                { provide: ShopSettingsService, useValue: {} },
                {
                    provide: Router,
                    useValue: {
                        get navigated() {
                            return navigated;
                        },
                        createUrlTree: (commands: string[]) => ({ commands }) as unknown as UrlTree,
                    },
                },
            ],
        });
        TestBed.inject(ModuleStore).ready.set(true);
    });

    const run = (url: string) =>
        TestBed.runInInjectionContext(() =>
            moduleGuard({} as never, { url } as never),
        ) as Promise<unknown>;

    it("should let every page through when the shop has the function", async () => {
        expect(await run("/customers")).toBe(true);
        expect(TestBed.inject(ModuleStore).locked()).toBeNull();
    });

    it("should always let the included pages through", async () => {
        TestBed.inject(ModuleStore).disabled.set(["customers", "audit"]);

        expect(await run("/sales/new")).toBe(true);
    });

    it("should stay on the page and show the message when a click opens a function the shop lacks", async () => {
        TestBed.inject(ModuleStore).disabled.set(["audit"]);

        expect(await run("/audit-logs")).toBe(false);
        expect(TestBed.inject(ModuleStore).locked()).toBe("audit");
    });

    it("should go to the home page, with the message, when the address was typed at start", async () => {
        navigated = false;
        TestBed.inject(ModuleStore).disabled.set(["customers"]);

        const result = (await run("/customers/12")) as { commands: string[] };

        expect(result.commands).toEqual(["/dashboard"]);
        expect(TestBed.inject(ModuleStore).locked()).toBe("customers");
    });
});

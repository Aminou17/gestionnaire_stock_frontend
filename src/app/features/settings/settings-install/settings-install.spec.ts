import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { SettingsInstall } from "./settings-install";
import { AuthService } from "../../../core/auth/auth.service";
import { InstallService } from "../../../core/pwa/install.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";

describe("SettingsInstall", () => {
    async function render(pwa: Partial<Record<string, unknown>>) {
        const install = vi.fn(async () => true);
        await TestBed.configureTestingModule({
            imports: [SettingsInstall],
            providers: [
                provideRouter([]),
                {
                    provide: InstallService,
                    useValue: {
                        canInstall: signal(false),
                        isInstalled$: signal(false),
                        platform: "android",
                        inAppBrowser: false,
                        install,
                        ...pwa,
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "A", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
                { provide: LowStockAlertService, useValue: { count: signal(0) } },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(SettingsInstall);
        await fixture.whenStable();
        return { el: fixture.nativeElement as HTMLElement, install };
    }

    it("should show the install button when the browser offers it, and install on tap", async () => {
        const { el, install } = await render({ canInstall: signal(true), platform: "ios" });

        const button = el.querySelector<HTMLButtonElement>("button.big")!;
        expect(button.textContent).toContain("Installer Boutiki");
        expect(el.querySelector(".hero .steps")).toBeNull();

        button.click();
        expect(install).toHaveBeenCalled();
    });

    it("should offer the Android app as a file to download", async () => {
        const { el } = await render({});

        const link = el.querySelector<HTMLAnchorElement>("a.big")!;
        expect(link.getAttribute("href")).toBe("/boutiki.apk");
        expect(link.textContent).toContain("Télécharger l'application");
        expect(el.textContent).toContain("Installer quand même");
    });

    it("should offer only the app on Android, never the browser install", async () => {
        const { el } = await render({ canInstall: signal(true) });

        expect(el.querySelector("a.big")).not.toBeNull();
        expect(el.querySelector("button.big")).toBeNull();
        expect(el.textContent).not.toContain("sans fichier");
    });

    it("should give the steps for the device when no install window is offered", async () => {
        const { el } = await render({ platform: "ios" });

        const steps = [...el.querySelectorAll(".steps li")].map((li) => li.textContent);
        expect(steps.length).toBe(3);
        expect(steps[1]).toContain("Partager");
    });

    it("should offer the app file on a computer too, to send it to a phone", async () => {
        const { el } = await render({ platform: "desktop" });

        expect(el.querySelector("a.big")?.getAttribute("href")).toBe("/boutiki.apk");
        expect(el.querySelector(".hero .steps")).toBeNull();
    });

    it("should explain the iPhone gesture with Safari", async () => {
        const { el } = await render({ platform: "ios" });

        expect(el.querySelector(".steps")?.textContent).toContain("Safari");
        expect(el.querySelector(".steps")?.textContent).toContain("Sur l'écran d'accueil");
    });

    it("should tell to leave the WhatsApp window before installing", async () => {
        const { el } = await render({ inAppBrowser: true });

        expect(el.querySelector(".alert")?.textContent).toContain("fenêtre intégrée");
        // le fichier Android reste proposé, le bouton du navigateur non
        expect(el.querySelector("a.big")?.getAttribute("href")).toBe("/boutiki.apk");
        expect(el.querySelector("button.big")).toBeNull();
    });

    it("should say it is installed, and still offer the Android file", async () => {
        const { el } = await render({ isInstalled$: signal(true) });

        expect(el.textContent).toContain("est installé");
        expect(el.querySelector("button.big")).toBeNull();
        expect(el.querySelector("a.big")?.getAttribute("href")).toBe("/boutiki.apk");
    });
});

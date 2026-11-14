import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { LogoResizerService } from "../logo-resizer.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsReceipt } from "./settings-receipt";

const shop = {
    name: "Awa Bazin",
    address: "Grand marché",
    phone: "06 123 45 67",
    tax_id: "IFU42",
    rccm: null,
    receipt_footer: "Ni repris ni échangé.",
    logo: null as string | null,
    updated_at: null,
};

describe("SettingsReceipt", () => {
    let fixture: ComponentFixture<SettingsReceipt>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;
    let updateLogo: ReturnType<typeof vi.fn>;
    let removeLogo: ReturnType<typeof vi.fn>;
    let resize: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        resize = vi.fn();
    });

    async function render(current = shop) {
        updateSettings = vi.fn((input) => of({ ...current, receipt_footer: input.receiptFooter }));
        updateLogo = vi.fn((logo: string) => of({ ...current, logo }));
        removeLogo = vi.fn(() => of({ ...current, logo: null }));

        await TestBed.configureTestingModule({
            imports: [SettingsReceipt],
            providers: [
                provideRouter([]),
                {
                    provide: ShopSettingsService,
                    useValue: {
                        getSettings: () => of(current),
                        updateSettings,
                        updateLogo,
                        removeLogo,
                    },
                },
                {
                    provide: SalesSettingsService,
                    useValue: {
                        getSettings: () => of({ ticket_prefix: "AB", default_max_discount: null }),
                    },
                },
                { provide: LogoResizerService, useValue: { resize } },
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({ id: 1, name: "Admin", email: "a@t.com", role: "admin" }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsReceipt);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const textarea = () => el.querySelector<HTMLTextAreaElement>("textarea")!;
    const ticket = () => el.querySelector(".ticket")!;

    async function type(value: string) {
        textarea().value = value;
        textarea().dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function chooseFile() {
        const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
        const file = new File(["x"], "logo.png", { type: "image/png" });
        Object.defineProperty(input, "files", { value: [file], configurable: true });
        input.dispatchEvent(new Event("change"));
        await fixture.whenStable();
    }

    const button = (label: string) =>
        [...el.querySelectorAll("button")].find((b) => b.textContent!.includes(label))!;

    it("should show the shop on the ticket preview", async () => {
        await render();

        expect(textarea().value).toBe("Ni repris ni échangé.");
        expect(ticket().textContent).toContain("Grand marché");
        expect(ticket().textContent).toContain("IFU IFU42");
        expect(ticket().textContent).toContain("Ni repris ni échangé.");
    });

    it("should use the ticket prefix of the sales settings in the preview", async () => {
        await render();

        expect(ticket().textContent).toContain("AB-000012");
    });

    it("should update the preview while typing", async () => {
        await render();

        await type("Échange sous 7 jours.");

        expect(ticket().textContent).toContain("Échange sous 7 jours.");
        expect(el.textContent).toContain("21 / 300");
    });

    it("should save the message and keep the shop information", async () => {
        await render();

        await type("Merci et à bientôt.");
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(updateSettings).toHaveBeenCalledWith({
            name: "Awa Bazin",
            address: "Grand marché",
            phone: "06 123 45 67",
            taxId: "IFU42",
            rccm: "",
            receiptFooter: "Merci et à bientôt.",
        });
        expect(el.textContent).toContain("Message du ticket enregistré.");
    });

    it("should link to the shop information", async () => {
        await render();

        expect(el.querySelector('a[href="/settings/shop"]')).toBeTruthy();
    });

    it("should show a placeholder and no delete button without logo", async () => {
        await render();

        expect(el.querySelector(".logo-image")).toBeNull();
        expect(el.textContent).toContain("Aucun logo");
        expect(button("Choisir une image")).toBeTruthy();
        expect(el.textContent).not.toContain("Supprimer le logo");
    });

    it("should show the saved logo on the form and on the ticket", async () => {
        await render({ ...shop, logo: "data:image/png;base64,AAAA" });

        expect(el.querySelector(".logo-image")!.getAttribute("src")).toContain("base64,AAAA");
        expect(el.querySelector(".ticket-logo")).toBeTruthy();
    });

    it("should resize the chosen image before sending it", async () => {
        resize.mockResolvedValue("data:image/png;base64,BBBB");
        await render();

        await chooseFile();

        expect(updateLogo).toHaveBeenCalledWith("data:image/png;base64,BBBB");
        expect(el.textContent).toContain("Logo enregistré.");
        expect(el.querySelector(".ticket-logo")).toBeTruthy();
    });

    it("should show why an image is refused", async () => {
        resize.mockRejectedValue(new Error("Choisissez une image PNG ou JPEG."));
        await render();

        await chooseFile();

        expect(updateLogo).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Choisissez une image PNG ou JPEG.");
    });

    it("should show the backend message when the logo is refused", async () => {
        resize.mockResolvedValue("data:image/png;base64,BBBB");
        await render();
        updateLogo.mockReturnValue(throwError(() => new Error("500")));

        await chooseFile();

        expect(el.textContent).toContain("Impossible d'enregistrer le logo.");
    });

    it("should delete the logo", async () => {
        await render({ ...shop, logo: "data:image/png;base64,AAAA" });

        button("Supprimer le logo").click();
        await fixture.whenStable();

        expect(removeLogo).toHaveBeenCalled();
        expect(el.textContent).toContain("Logo supprimé.");
        expect(el.querySelector(".ticket-logo")).toBeNull();
    });

    it("should keep the message being typed when the logo changes", async () => {
        resize.mockResolvedValue("data:image/png;base64,BBBB");
        await render();

        await type("Texte pas encore enregistré");
        await chooseFile();

        expect(textarea().value).toBe("Texte pas encore enregistré");
    });

    it("should ask before leaving with unsaved changes", async () => {
        await render();

        await type("Autre message");
        const ask = vi.fn(() => Promise.resolve(false));
        fixture.debugElement.query((d) => d.name === "app-unsaved-dialog").componentInstance.ask =
            ask;

        expect(await fixture.componentInstance.canLeave()).toBe(false);
        expect(ask).toHaveBeenCalled();
    });
});

import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";

import { OwnerShopService } from "../owner-shop.service";
import { NewShopDialog } from "./new-shop-dialog";

describe("NewShopDialog", () => {
    let createShop: any;

    beforeAll(() => {
        HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
            this.open = true;
        };
        HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
            this.open = false;
        };
    });

    const render = async () => {
        await TestBed.configureTestingModule({
            imports: [NewShopDialog],
            providers: [
                {
                    provide: OwnerShopService,
                    useValue: { createShop: (...a: unknown[]) => createShop(...a) },
                },
            ],
        }).compileComponents();
        const fixture = TestBed.createComponent(NewShopDialog);
        await fixture.whenStable();
        fixture.componentInstance.open();
        return fixture;
    };

    const fill = (dialog: NewShopDialog) =>
        dialog.form.setValue({
            shopName: " Chez Fatou ",
            adminName: "Fatou Diallo",
            email: "fatou@exemple.com",
            password: "Provisoire-2026",
        });

    it("should create the shop and show the access to send, once", async () => {
        createShop = vi.fn(() =>
            of({
                id: 3,
                name: "Chez Fatou",
                status: "ACTIVE",
                created_at: "",
                admin: { id: 9, name: "Fatou Diallo", email: "fatou@exemple.com", role: "admin" },
            }),
        );
        const fixture = await render();
        const created = vi.fn();
        fixture.componentInstance.created.subscribe(created);

        fill(fixture.componentInstance);
        fixture.componentInstance.submit();
        await fixture.whenStable();

        expect(createShop).toHaveBeenCalledWith({
            shopName: "Chez Fatou",
            adminName: "Fatou Diallo",
            email: "fatou@exemple.com",
            password: "Provisoire-2026",
        });
        expect(created).toHaveBeenCalled();
        const text = fixture.nativeElement.querySelector(".credentials")?.textContent;
        expect(text).toContain("fatou@exemple.com");
        expect(text).toContain("Provisoire-2026");
    });

    it("should say when the access cannot be copied", async () => {
        createShop = vi.fn(() =>
            of({
                id: 3,
                name: "Chez Fatou",
                status: "ACTIVE",
                created_at: "",
                admin: { id: 9, name: "Fatou Diallo", email: "fatou@exemple.com", role: "admin" },
            }),
        );
        const fixture = await render();
        fill(fixture.componentInstance);
        fixture.componentInstance.submit();
        await fixture.whenStable();

        // adresse en http : le navigateur ne donne pas de presse-papiers
        Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        fixture.componentInstance.copy();
        delete (navigator as { clipboard?: Clipboard }).clipboard;
        await fixture.whenStable();

        const alert = fixture.nativeElement.querySelector(".done [role=alert]");
        expect(alert?.textContent).toContain("Copie impossible");
    });

    it("should not send an incomplete form", async () => {
        createShop = vi.fn();
        const fixture = await render();
        fixture.componentInstance.submit();
        expect(createShop).not.toHaveBeenCalled();
    });

    it("should show the message of the API when the email is taken", async () => {
        createShop = vi.fn(() =>
            throwError(() => ({ error: { message: "Cet email est déjà utilisé." } })),
        );
        const fixture = await render();
        fill(fixture.componentInstance);
        fixture.componentInstance.submit();
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain("Cet email est déjà utilisé.");
    });

    it("should generate a 12 character password without look-alike characters", async () => {
        const fixture = await render();
        fixture.componentInstance.generatePassword();
        const password = fixture.componentInstance.form.controls.password.value;
        expect(password).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{12}$/);
    });
});

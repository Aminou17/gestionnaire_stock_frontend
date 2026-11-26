import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { AlertEmailSettings } from "../../../core/stock/alert-email.model";
import { AlertEmailService } from "../../../core/stock/alert-email.service";
import { SettingsHistoryService } from "../settings-history/settings-history.service";
import { SettingsAlertEmail } from "./settings-alert-email";

const saved: AlertEmailSettings = {
    enabled: false,
    recipient: "adam@test.com",
    sendHour: 8,
    onlyIfAlerts: true,
    lastSentOn: null,
    lastError: null,
};

describe("SettingsAlertEmail", () => {
    let fixture: ComponentFixture<SettingsAlertEmail>;
    let el: HTMLElement;
    let updateSettings: ReturnType<typeof vi.fn>;
    let sendTest: ReturnType<typeof vi.fn>;

    async function render(settings: AlertEmailSettings = saved, loadError = false) {
        updateSettings = vi.fn((input) => of({ ...settings, ...input }));
        sendTest = vi.fn(() => of({ sent: true, alertCount: 2 }));

        await TestBed.configureTestingModule({
            imports: [SettingsAlertEmail],
            providers: [
                provideRouter([]),
                { provide: SettingsHistoryService, useValue: { getLastChange: () => of(null) } },
                {
                    provide: AlertEmailService,
                    useValue: {
                        getSettings: () =>
                            loadError
                                ? throwError(() => new HttpErrorResponse({ status: 500 }))
                                : of(settings),
                        updateSettings,
                        sendTest,
                    },
                },
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

        fixture = TestBed.createComponent(SettingsAlertEmail);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const field = (name: string) =>
        el.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>("button"));
    const button = (label: string) => buttons().find((b) => b.textContent?.includes(label))!;

    async function type(name: string, value: string) {
        field(name).value = value;
        field(name).dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    it("affiche les réglages enregistrés, sans aucun compte Gmail à régler", async () => {
        await render();

        expect(field("recipient").value).toBe("adam@test.com");
        expect(el.textContent).not.toContain("Gmail");
        expect(el.querySelector("input[type=password]")).toBeNull();
    });

    it("propose l'adresse de l'administrateur quand aucun destinataire n'est enregistré", async () => {
        await render({ ...saved, recipient: null });

        expect(field("recipient").value).toBe("a@t.com");
        expect(buttons().some((b) => b.textContent?.includes("Envoyer un essai"))).toBe(false);
    });

    it("envoie les modifications au serveur", async () => {
        await render();

        await type("recipient", "proprietaire@gmail.com");
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ recipient: "proprietaire@gmail.com" }),
        );
        expect(el.textContent).toContain("Enregistré.");
    });

    it("refuse une adresse non valide sans appeler le serveur", async () => {
        await render();

        await type("recipient", "pas-une-adresse");
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Adresse e-mail non valide.");
    });

    it("affiche l'erreur du serveur à l'enregistrement", async () => {
        await render();
        updateSettings.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: { message: "Indiquez l'adresse qui recevra le résumé." },
                    }),
            ),
        );

        await type("recipient", "autre@gmail.com");
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(el.textContent).toContain("Indiquez l'adresse qui recevra le résumé.");
    });

    it("envoie un test quand rien n'est en cours de modification", async () => {
        await render();

        button("Envoyer un essai").click();
        await fixture.whenStable();

        expect(sendTest).toHaveBeenCalled();
        expect(el.textContent).toContain("E-mail envoyé.");
    });

    it("cache l'essai tant que les modifications ne sont pas enregistrées", async () => {
        await render();

        await type("recipient", "autre@gmail.com");

        expect(buttons().some((b) => b.textContent?.includes("Envoyer un essai"))).toBe(false);
    });

    it("refuse d'activer avec une adresse vide", async () => {
        await render({ ...saved, recipient: null });

        await type("recipient", "");
        field("enabled").click();
        await fixture.whenStable();
        el.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit"));
        await fixture.whenStable();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(el.textContent).toContain("Indiquez l'adresse qui recevra le résumé.");
    });

    it("montre le dernier échec d'envoi", async () => {
        await render({ ...saved, lastError: "L'e-mail n'a pas pu être envoyé." });

        expect(el.textContent).toContain(
            "Dernier envoi en échec : L'e-mail n'a pas pu être envoyé.",
        );
    });

    it("propose de réessayer quand le chargement échoue", async () => {
        await render(saved, true);

        expect(el.textContent).toContain("Impossible de charger les réglages.");
    });
});

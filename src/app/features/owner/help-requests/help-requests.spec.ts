import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { HelpRequest } from "../../../core/help/help.model";
import { HelpService } from "../../../core/help/help.service";
import { HelpRequests } from "./help-requests";

const request = (overrides: Partial<HelpRequest> = {}): HelpRequest => ({
    id: 4,
    name: "Adam Traoré",
    email: "adam@exemple.com",
    shop_name: "Chez Adam",
    reason: "blocked",
    message: "Mon compte est bloqué.",
    status: "OPEN",
    reply: null,
    replied_at: null,
    created_at: "2026-11-22T10:00:00.000Z",
    ...overrides,
});

describe("HelpRequests", () => {
    let service: Record<string, ReturnType<typeof vi.fn>>;

    const render = async (list: HelpRequest[] = [request()]) => {
        service = {
            getRequests: vi.fn(() => of(list)),
            reply: vi.fn(() => of(request({ status: "CLOSED" }))),
            setStatus: vi.fn(() => of(request({ status: "CLOSED" }))),
            refreshOpen: vi.fn(),
        };
        await TestBed.configureTestingModule({
            imports: [HelpRequests],
            providers: [provideRouter([]), { provide: HelpService, useValue: service }],
        }).compileComponents();
        const fixture = TestBed.createComponent(HelpRequests);
        await fixture.whenStable();
        return fixture;
    };

    beforeAll(() => {
        // Jsdom n'implémente pas les fenêtres <dialog>
        HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
            this.open = true;
        };
        HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
            this.open = false;
        };
    });

    it("should list the open requests with the person and the reason", async () => {
        const fixture = await render();
        const text = (fixture.nativeElement as HTMLElement).textContent;

        expect(service["getRequests"]).toHaveBeenCalledWith("OPEN");
        expect(text).toContain("Adam Traoré");
        expect(text).toContain("Mon compte est bloqué ou suspendu");
        expect(text).toContain("Chez Adam");
    });

    it("should send the answer by e-mail and reload the list", async () => {
        const fixture = await render();
        fixture.componentInstance.open(request());
        fixture.componentInstance.reply.set("Bonjour, c'est réglé.");

        fixture.componentInstance.send();
        await fixture.whenStable();

        expect(service["reply"]).toHaveBeenCalledWith(4, "Bonjour, c'est réglé.");
        expect(service["getRequests"]).toHaveBeenCalledTimes(2);
    });

    it("should refuse an empty answer", async () => {
        const fixture = await render();
        fixture.componentInstance.open(request());

        fixture.componentInstance.send();

        expect(service["reply"]).not.toHaveBeenCalled();
        expect(fixture.componentInstance.error()).toContain("Écrivez votre réponse");
    });

    it("should keep the request open and show why when the e-mail cannot leave", async () => {
        const fixture = await render();
        service["reply"].mockReturnValue(
            throwError(() => ({ error: { message: "L'envoi d'e-mails n'est pas configuré." } })),
        );
        fixture.componentInstance.open(request());
        fixture.componentInstance.reply.set("Bonjour");

        fixture.componentInstance.send();

        expect(fixture.componentInstance.error()).toBe("L'envoi d'e-mails n'est pas configuré.");
        expect(fixture.componentInstance.busy()).toBe(false);
    });

    it("should close a request without answering", async () => {
        const fixture = await render();
        fixture.componentInstance.open(request());

        fixture.componentInstance.toggle();

        expect(service["setStatus"]).toHaveBeenCalledWith(4, "CLOSED");
    });
});

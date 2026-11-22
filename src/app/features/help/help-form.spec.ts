import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";

import { HelpService } from "../../core/help/help.service";
import { HelpForm } from "./help-form";

describe("HelpForm", () => {
    let service: { send: ReturnType<typeof vi.fn> };

    const render = async () => {
        service = { send: vi.fn(() => of({ message: "ok" })) };
        await TestBed.configureTestingModule({
            imports: [HelpForm],
            providers: [provideRouter([]), { provide: HelpService, useValue: service }],
        }).compileComponents();
        const fixture = TestBed.createComponent(HelpForm);
        fixture.detectChanges();
        return fixture;
    };

    const fill = (fixture: Awaited<ReturnType<typeof render>>) =>
        fixture.componentInstance.form.patchValue({
            name: "Awa Traoré",
            email: "Awa@Exemple.com ",
            shopName: " Chez Awa ",
            reason: "blocked",
            message: "Mon compte est bloqué depuis ce matin.",
        });

    it("should not need a connection and ask where to answer", async () => {
        const fixture = await render();
        const text = (fixture.nativeElement as HTMLElement).textContent;

        expect(text).toContain("E-mail où vous répondre");
        expect(text).toContain("moins de 3 h");
    });

    it("should refuse an empty form without calling the API", async () => {
        const fixture = await render();

        fixture.componentInstance.submit();

        expect(service.send).not.toHaveBeenCalled();
    });

    it("should send the request with a clean lowercase address", async () => {
        const fixture = await render();
        fill(fixture);

        fixture.componentInstance.submit();

        const sent = service.send.mock.calls[0][0];
        expect(sent.email).toBe("awa@exemple.com");
        expect(sent.shopName).toBe("Chez Awa");
        expect(sent.reason).toBe("blocked");
        expect(typeof sent.elapsedMs).toBe("number");
    });

    it("should confirm where the answer will arrive", async () => {
        const fixture = await render();
        fill(fixture);

        fixture.componentInstance.submit();
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain("awa@exemple.com");
        expect(fixture.componentInstance.sentTo()).toBe("awa@exemple.com");
    });

    it("should show the message of the API when the send fails", async () => {
        const fixture = await render();
        service.send.mockReturnValue(
            throwError(() => ({ status: 429, error: { message: "Trop de messages envoyés." } })),
        );
        fill(fixture);

        fixture.componentInstance.submit();
        fixture.detectChanges();

        expect(fixture.componentInstance.error()).toBe("Trop de messages envoyés.");
        expect(fixture.componentInstance.sentTo()).toBeNull();
    });
});

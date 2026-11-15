import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { MailSettings, MailSettingsService } from "../mail-settings.service";
import { MailSettingsPage } from "./mail-settings";

describe("MailSettingsPage", () => {
    let save: ReturnType<typeof vi.fn>;

    async function render(settings: MailSettings) {
        save = vi.fn(() =>
            of({
                ...settings,
                gmailUser: "a@gmail.com",
                hasPassword: true,
                activeSource: "database",
            }),
        );
        await TestBed.configureTestingModule({
            imports: [MailSettingsPage],
            providers: [
                provideRouter([]),
                {
                    provide: MailSettingsService,
                    useValue: { get: () => of(settings), save, remove: vi.fn(), sendTest: vi.fn() },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(MailSettingsPage);
        await fixture.whenStable();
        return fixture;
    }

    const none: MailSettings = {
        gmailUser: null,
        hasPassword: false,
        unreadable: false,
        updatedAt: null,
        activeSource: "none",
    };

    it("should warn that no e-mail leaves while nothing is set", async () => {
        const fixture = await render(none);
        expect(fixture.nativeElement.querySelector(".status.off")?.textContent).toContain(
            "ne partent pas",
        );
    });

    it("should ask for the app password when none is saved", async () => {
        const fixture = await render(none);
        fixture.componentInstance.form.setValue({ gmailUser: "a@gmail.com", gmailPassword: "" });
        fixture.componentInstance.save();

        expect(save).not.toHaveBeenCalled();
        expect(fixture.componentInstance.message()?.ok).toBe(false);
    });

    it("should save the address with its password", async () => {
        const fixture = await render(none);
        fixture.componentInstance.form.setValue({
            gmailUser: " a@gmail.com ",
            gmailPassword: "abcd efgh ijkl mnop",
        });
        fixture.componentInstance.save();
        await fixture.whenStable();

        expect(save).toHaveBeenCalledWith("a@gmail.com", "abcd efgh ijkl mnop");
        expect(fixture.componentInstance.message()?.ok).toBe(true);
    });
});

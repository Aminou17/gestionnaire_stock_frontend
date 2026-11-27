import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AnnouncementService } from "../../core/announcements/announcement.service";
import { SupportService } from "../../core/support/support.service";
import { MessageButton } from "./message-button";

describe("MessageButton", () => {
    async function render(news: number, replies: number) {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: AnnouncementService, useValue: { unread: signal(news) } },
                { provide: SupportService, useValue: { unread: signal(replies) } },
            ],
        });
        const fixture = TestBed.createComponent(MessageButton);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    it("should stay hidden without a new message", async () => {
        const host = await render(0, 0);

        expect(host.querySelector("a")).toBeNull();
        expect(host.style.display).toBe("none");
    });

    it("should count both kinds of new messages", async () => {
        const host = await render(2, 1);

        expect(host.querySelector(".dot")?.textContent).toContain("3");
        expect(host.querySelector("a")?.getAttribute("href")).toBe("/messages");
    });

    it("should open the conversations when only a support reply is new", async () => {
        const host = await render(0, 1);

        expect(host.querySelector("a")?.getAttribute("href")).toBe("/support");
    });
});

import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AnnouncementService } from "../../core/announcements/announcement.service";
import { SupportService } from "../../core/support/support.service";
import { Icon } from "../../shared/icon/icon";

// Apparaît seulement quand un message attend : une nouvelle ou une réponse du support
@Component({
    selector: "app-message-button",
    imports: [RouterLink, Icon],
    template: `
        @if (unread()) {
            <a [routerLink]="link()" [attr.aria-label]="'Messages, ' + unread() + ' non lus'">
                <app-icon name="message" [size]="20" />
                <span class="dot" aria-hidden="true">{{ unread() }}</span>
            </a>
        }
    `,
    // Sans nouveau message, le bouton ne prend aucune place dans la barre
    host: { "[style.display]": "unread() ? null : 'none'" },
    styles: `
        a {
            position: relative;
            display: grid;
            flex: none;
            place-items: center;
            width: 44px;
            height: 44px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--surface);
            color: var(--text);
        }

        a:hover {
            background: var(--surface-hover);
        }

        a:focus-visible {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
        }

        .dot {
            position: absolute;
            top: 5px;
            right: 5px;
            display: grid;
            place-items: center;
            min-width: 17px;
            height: 17px;
            padding: 0 4px;
            border-radius: 999px;
            background: var(--notification);
            color: var(--notification-text);
            font-size: var(--fs-micro);
            font-weight: var(--fw-semibold);
        }
    `,
})
export class MessageButton {
    private announcements = inject(AnnouncementService);
    private support = inject(SupportService);

    protected unread = computed(() => this.announcements.unread() + this.support.unread());
    // Directement sur les conversations quand il n'y a de nouveau que là
    protected link = computed(() =>
        !this.announcements.unread() && this.support.unread() ? "/support" : "/messages",
    );
}

import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AnnouncementService } from "../../../core/announcements/announcement.service";
import { PRODUCT_NAME } from "../../../core/brand";
import { SupportService } from "../../../core/support/support.service";

// Une seule boîte pour l'administrateur : les nouvelles du logiciel et ses conversations avec le support
@Component({
    selector: "app-message-tabs",
    imports: [RouterLink, RouterLinkActive],
    template: `
        <nav aria-label="Messages">
            <a routerLink="/messages" routerLinkActive="on" ariaCurrentWhenActive="page">
                {{ productName }}
                @if (announcements.unread()) {
                    <span class="count">{{ announcements.unread() }}</span>
                }
            </a>
            <a routerLink="/support" routerLinkActive="on" ariaCurrentWhenActive="page">
                Mes conversations
                @if (support.unread()) {
                    <span class="count">{{ support.unread() }}</span>
                }
            </a>
        </nav>
    `,
    styles: `
        nav {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            max-width: 420px;
            padding: 4px;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--surface);
        }

        a {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            min-height: 40px;
            border-radius: 9px;
            color: var(--text-muted);
            font-weight: var(--fw-semibold);
            text-decoration: none;
        }

        a.on {
            background: var(--primary);
            color: #fff;
        }

        a:focus-visible {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
        }

        .count {
            display: grid;
            place-items: center;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            border-radius: 999px;
            background: var(--notification);
            color: var(--notification-text);
            font-size: var(--fs-micro);
        }
    `,
})
export class MessageTabs {
    protected announcements = inject(AnnouncementService);
    protected support = inject(SupportService);
    protected productName = PRODUCT_NAME;
}

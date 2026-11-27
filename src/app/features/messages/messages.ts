import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { AnnouncementAction, ShopAnnouncement } from "../../core/announcements/announcement.model";
import { AnnouncementService } from "../../core/announcements/announcement.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { MessageTabs } from "./message-tabs/message-tabs";

const ACTIONS: Record<AnnouncementAction, { label: string; link: string }> = {
    shop: { label: "Compléter ma boutique", link: "/settings/shop" },
    products: { label: "Voir mes produits", link: "/products" },
};

// Les messages envoyés à la boutique : on touche un message pour le lire et y répondre
@Component({
    selector: "app-messages",
    imports: [DatePipe, FormsModule, RouterLink, PageHeader, EmptyState, Icon, MessageTabs],
    templateUrl: "./messages.html",
    styleUrl: "./messages.css",
})
export class Messages {
    private announcements = inject(AnnouncementService);
    protected actions = ACTIONS;

    messages = rxResource({ stream: () => this.announcements.getMine() });

    openId = signal<number | null>(null);
    reply = signal("");
    sending = signal(false);
    error = signal<string | null>(null);

    toggle(message: ShopAnnouncement) {
        const opening = this.openId() !== message.id;
        this.openId.set(opening ? message.id : null);
        this.reply.set("");
        this.error.set(null);

        if (opening && !message.read_at) {
            this.announcements.open(message.id).subscribe({
                next: (read) => this.replace(read),
                error: () => {},
            });
        }
    }

    send(message: ShopAnnouncement) {
        const text = this.reply().trim();
        if (!text || this.sending()) return;

        this.sending.set(true);
        this.error.set(null);

        this.announcements.reply(message.id, text).subscribe({
            next: ({ threadId }) => {
                this.sending.set(false);
                this.reply.set("");
                this.replace({
                    ...message,
                    read_at: message.read_at ?? new Date().toISOString(),
                    replied_at: new Date().toISOString(),
                    thread_id: threadId,
                });
            },
            error: (err: HttpErrorResponse) => {
                this.sending.set(false);
                this.error.set(err.error?.message ?? "La réponse n'est pas partie, réessayez.");
            },
        });
    }

    private replace(updated: ShopAnnouncement) {
        this.messages.update((list) =>
            list?.map((item) => (item.id === updated.id ? updated : item)),
        );
    }
}

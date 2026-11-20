import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { SupportSide, SupportThread } from "../../core/support/support.model";
import { SupportService } from "../../core/support/support.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";

type Filter = "open" | "closed";

export const MAX_MESSAGE = 2000;

// La messagerie d'assistance : liste des conversations à gauche, conversation à droite.
// Les utilisateurs d'une boutique écrivent au support ; le propriétaire lit et répond.
// Sur téléphone on voit l'un ou l'autre.
@Component({
    selector: "app-support-inbox",
    imports: [DatePipe, FormsModule, RouterLink, PageHeader, Icon, EmptyState],
    templateUrl: "./support-inbox.html",
    styleUrl: "./support-inbox.css",
})
export class SupportInbox {
    private support = inject(SupportService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    protected maxMessage = MAX_MESSAGE;

    protected side: SupportSide = this.route.snapshot.data["side"];
    protected isOwner = this.side === "owner";
    protected base = this.isOwner ? "/owner/support" : "/support";

    // "new" ouvre le formulaire d'un nouveau message
    private idParam = toSignal(this.route.paramMap.pipe(map((params) => params.get("id"))), {
        initialValue: this.route.snapshot.paramMap.get("id"),
    });
    protected composing = this.route.snapshot.data["compose"] === true;
    protected threadId = computed(() => {
        const id = Number(this.idParam());
        return Number.isInteger(id) && id > 0 ? id : null;
    });

    protected filter = signal<Filter>("open");

    protected threads = rxResource({ stream: () => this.support.getThreads(this.side) });

    protected thread = rxResource({
        params: () => this.threadId() ?? undefined,
        stream: ({ params }) => this.support.getThread(this.side, params),
    });

    protected list = computed(() => {
        const all = this.threads.hasValue() ? this.threads.value() : [];
        return all.filter((t) =>
            this.filter() === "open" ? t.status === "OPEN" : t.status === "CLOSED",
        );
    });

    protected openCount = computed(
        () =>
            (this.threads.hasValue() ? this.threads.value() : []).filter((t) => t.status === "OPEN")
                .length,
    );

    protected reply = signal("");
    protected subject = signal("");
    protected newMessage = signal("");
    protected sending = signal(false);
    protected error = signal<string | null>(null);

    private scroller = viewChild<ElementRef<HTMLElement>>("scroller");

    constructor() {
        // la conversation s'ouvre sur le dernier message
        effect(() => {
            if (!this.thread.hasValue()) return;
            setTimeout(() => {
                const el = this.scroller()?.nativeElement;
                if (el) el.scrollTop = el.scrollHeight;
            });
        });
    }

    protected isUnread(thread: SupportThread) {
        return this.isOwner ? thread.owner_unread : thread.user_unread;
    }

    protected open(thread: SupportThread) {
        this.error.set(null);
        this.router.navigate([this.base, thread.id]);
    }

    protected title() {
        return this.isOwner ? "Messages des boutiques" : "Assistance";
    }

    protected subtitle() {
        return this.isOwner
            ? "Les questions de vos clients, avec leur boutique"
            : "Écrivez-nous, nous vous répondons ici et par e-mail";
    }

    private fail(err: HttpErrorResponse) {
        this.sending.set(false);
        this.error.set(
            err.status === 0
                ? "Impossible de joindre le serveur. Vérifiez votre connexion."
                : (err.error?.message ?? "Une erreur est survenue, réessayez."),
        );
    }

    protected sendReply() {
        const id = this.threadId();
        const message = this.reply().trim();
        if (!id || !message || this.sending()) return;

        this.sending.set(true);
        this.error.set(null);

        this.support.sendMessage(this.side, id, message).subscribe({
            next: () => {
                this.sending.set(false);
                this.reply.set("");
                this.thread.reload();
                this.threads.reload();
            },
            error: (err: HttpErrorResponse) => this.fail(err),
        });
    }

    protected createThread() {
        const subject = this.subject().trim();
        const message = this.newMessage().trim();
        if (!subject || !message || this.sending()) return;

        this.sending.set(true);
        this.error.set(null);

        this.support.createThread(subject, message).subscribe({
            next: (thread) => {
                this.sending.set(false);
                this.subject.set("");
                this.newMessage.set("");
                this.threads.reload();
                this.router.navigate([this.base, thread.id]);
            },
            error: (err: HttpErrorResponse) => this.fail(err),
        });
    }

    protected toggleStatus() {
        if (!this.thread.hasValue()) return;
        const { id, status } = this.thread.value();

        this.support.setStatus(id, status === "OPEN" ? "CLOSED" : "OPEN").subscribe({
            next: () => {
                this.thread.reload();
                this.threads.reload();
            },
            error: (err: HttpErrorResponse) => this.fail(err),
        });
    }

    // Ctrl+Entrée ou Cmd+Entrée envoie, Entrée seule saute une ligne
    protected onKeydown(event: KeyboardEvent, action: "reply" | "create") {
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;

        event.preventDefault();
        if (action === "reply") this.sendReply();
        else this.createThread();
    }
}

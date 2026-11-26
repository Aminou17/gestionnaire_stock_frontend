import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { SupportSide, SupportThread } from "../../core/support/support.model";
import { HelpService } from "../../core/help/help.service";
import { SupportService } from "../../core/support/support.service";
import { HelpRequests } from "../owner/help-requests/help-requests";
import { PageHeader } from "../../layout/page-header/page-header";
import { BackLink } from "../../shared/back-link/back-link";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";

// "nocount" : les demandes envoyées depuis la page de connexion (propriétaire seulement)
type Filter = "open" | "closed" | "nocount";

export const MAX_MESSAGE = 2000;

// La messagerie d'assistance : liste des conversations à gauche, conversation à droite.
// Les utilisateurs d'une boutique écrivent au support ; le propriétaire lit et répond.
// Sur téléphone on voit l'un ou l'autre.
@Component({
    selector: "app-support-inbox",
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        BackLink,
        PageHeader,
        Icon,
        EmptyState,
        HelpRequests,
    ],
    templateUrl: "./support-inbox.html",
    styleUrl: "./support-inbox.css",
})
export class SupportInbox {
    private support = inject(SupportService);
    protected help = inject(HelpService);
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

    // L'ancienne adresse /owner/help ouvre directement l'onglet « Sans compte »
    protected filter = signal<Filter>(
        this.isOwner && this.route.snapshot.queryParamMap.get("onglet") === "sans-compte"
            ? "nocount"
            : "open",
    );

    protected threads = rxResource({ stream: () => this.support.getThreads(this.side) });

    protected thread = rxResource({
        params: () => this.threadId() ?? undefined,
        stream: ({ params }) => this.support.getThread(this.side, params),
    });

    protected list = computed(() => {
        const all = this.threads.hasValue() ? this.threads.value() : [];
        return all.filter((t) =>
            this.filter() === "closed" ? t.status === "CLOSED" : t.status === "OPEN",
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
        // La conversation s'ouvre sur le dernier message
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
        return this.isOwner ? "Messages" : "Assistance";
    }

    protected subtitle() {
        return this.isOwner ? undefined : "Réponse en moins de 3 h en général";
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
                // La conversation créée prend la place du formulaire dans l'historique
                this.router.navigate([this.base, thread.id], { replaceUrl: true });
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

import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, ElementRef, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";

import { HelpRequest, helpReasonLabel } from "../../../core/help/help.model";
import { HelpService } from "../../../core/help/help.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { EmptyState } from "../../../shared/empty-state/empty-state";
import { Icon } from "../../../shared/icon/icon";

// Demandes envoyées depuis la page de connexion par des personnes sans accès à leur compte.
// On y répond ici : la réponse part par e-mail à l'adresse laissée.
@Component({
    selector: "app-help-requests",
    imports: [DatePipe, FormsModule, PageHeader, EmptyState, Icon],
    templateUrl: "./help-requests.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./help-requests.css"],
})
export class HelpRequests {
    private help = inject(HelpService);
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    status = signal<"OPEN" | "CLOSED">("OPEN");
    requests = rxResource({
        params: () => this.status(),
        stream: ({ params }) => this.help.getRequests(params),
    });

    reasonLabel = helpReasonLabel;

    selected = signal<HelpRequest | null>(null);
    reply = signal("");
    busy = signal(false);
    error = signal<string | null>(null);

    constructor() {
        this.help.refreshOpen();
    }

    open(request: HelpRequest) {
        this.selected.set(request);
        this.reply.set("");
        this.error.set(null);
        this.dialog().nativeElement.showModal();
    }

    close() {
        if (this.busy()) return;
        this.dialog().nativeElement.close();
    }

    private done() {
        this.busy.set(false);
        this.dialog().nativeElement.close();
        this.requests.reload();
        this.help.refreshOpen();
    }

    private fail(err: HttpErrorResponse, fallback: string) {
        this.busy.set(false);
        this.error.set(err.error?.message ?? fallback);
    }

    send() {
        const request = this.selected();
        if (!request) return;

        if (this.reply().trim().length < 2) {
            this.error.set("Écrivez votre réponse.");
            return;
        }

        this.busy.set(true);
        this.error.set(null);

        this.help.reply(request.id, this.reply().trim()).subscribe({
            next: () => this.done(),
            error: (err: HttpErrorResponse) => this.fail(err, "Impossible d'envoyer la réponse."),
        });
    }

    // clore sans répondre, ou rouvrir une demande close
    toggle() {
        const request = this.selected();
        if (!request) return;

        this.busy.set(true);
        this.error.set(null);

        this.help.setStatus(request.id, request.status === "OPEN" ? "CLOSED" : "OPEN").subscribe({
            next: () => this.done(),
            error: (err: HttpErrorResponse) => this.fail(err, "Impossible de changer le statut."),
        });
    }
}

import { DatePipe } from "@angular/common";
import { Component, ElementRef, inject, signal, viewChild } from "@angular/core";

import { NetworkService } from "../../../core/offline/network.service";
import { PendingSale, SaleOutboxService } from "../../../core/offline/sale-outbox.service";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Ventes faites sans internet et pas encore reçues par le serveur, ouvertes depuis le bandeau
@Component({
    selector: "app-pending-sales-dialog",
    imports: [DatePipe, Icon, FcfaPipe],
    templateUrl: "./pending-sales-dialog.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./pending-sales-dialog.css"],
})
export class PendingSalesDialog {
    protected outbox = inject(SaleOutboxService);
    protected network = inject(NetworkService);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    sending = signal(false);
    // vente dont on confirme la suppression
    removing = signal<string | null>(null);

    open() {
        this.removing.set(null);
        this.dialog().nativeElement.showModal();
    }

    close() {
        this.dialog().nativeElement.close();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    protected statusLabel(sale: PendingSale) {
        switch (sale.status) {
            case "sending":
                return "Envoi…";
            case "error":
                return "À vérifier";
            default:
                return "En attente";
        }
    }

    async sendNow() {
        this.sending.set(true);
        await this.outbox.sync();
        this.sending.set(false);
    }

    async retry(sale: PendingSale) {
        await this.outbox.retry(sale.clientRef);
    }

    async confirmRemove(sale: PendingSale) {
        await this.outbox.remove(sale.clientRef);
        this.removing.set(null);
    }
}

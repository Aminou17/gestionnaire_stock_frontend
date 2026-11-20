import { DatePipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

import { NetworkService } from "../../../core/offline/network.service";
import { PendingSale, SaleOutboxService } from "../../../core/offline/sale-outbox.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// Ventes faites sans internet et pas encore reçues par le serveur
@Component({
    selector: "app-pending-sales",
    imports: [DatePipe, RouterLink, PageHeader, Icon, FcfaPipe],
    templateUrl: "./pending-sales.html",
    styleUrl: "./pending-sales.css",
})
export class PendingSales {
    protected outbox = inject(SaleOutboxService);
    protected network = inject(NetworkService);

    sending = signal(false);
    // vente dont on confirme la suppression
    removing = signal<string | null>(null);

    protected statusLabel(sale: PendingSale) {
        switch (sale.status) {
            case "sending":
                return "Envoi…";
            case "cash":
                return "Caisse fermée";
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

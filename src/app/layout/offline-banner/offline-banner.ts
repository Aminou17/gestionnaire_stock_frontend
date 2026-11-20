import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { NetworkService } from "../../core/offline/network.service";
import { SaleOutboxService } from "../../core/offline/sale-outbox.service";
import { Icon } from "../../shared/icon/icon";

// Bandeau discret en haut des pages : hors ligne, ventes en attente d'envoi, ventes à vérifier
@Component({
    selector: "app-offline-banner",
    imports: [RouterLink, Icon],
    template: `
        @if (state(); as s) {
            <a class="bar" routerLink="/sales/pending" [attr.data-tone]="s.tone" role="status">
                <span class="dot" aria-hidden="true"></span>
                <span class="text">{{ s.text }}</span>
                @if (outbox.count() > 0) {
                    <span class="count">{{ outbox.count() }}</span>
                }
                <app-icon name="chevron-right" [size]="16" />
            </a>
        }
    `,
    styleUrl: "./offline-banner.css",
})
export class OfflineBanner {
    private network = inject(NetworkService);
    protected outbox = inject(SaleOutboxService);

    protected state = computed(() => {
        const count = this.outbox.count();
        const plural = count > 1 ? "s" : "";

        if (!this.network.online()) {
            return {
                tone: "offline",
                text:
                    count > 0
                        ? `Hors ligne · ${count} vente${plural} gardée${plural} sur cet appareil`
                        : "Hors ligne · la vente continue sur cet appareil",
            };
        }
        if (this.outbox.needsAttention() > 0) {
            const n = this.outbox.needsAttention();
            return { tone: "error", text: `${n} vente${n > 1 ? "s" : ""} hors ligne à vérifier` };
        }
        if (count > 0) {
            return {
                tone: "sending",
                text: `Envoi de ${count} vente${plural} faite${plural} hors ligne…`,
            };
        }
        return null;
    });
}

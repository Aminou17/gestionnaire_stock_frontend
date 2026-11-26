import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { Icon } from "../../../shared/icon/icon";
import { OwnerShopService } from "../owner-shop.service";

// L'interrupteur des abonnements : tant qu'il est éteint, le logiciel est gratuit et la page Abonnement n'existe pas.
// Chaque changement demande une confirmation.
@Component({
    selector: "app-subscriptions-switch",
    imports: [DatePipe, Icon],
    templateUrl: "./subscriptions-switch.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./subscriptions-switch.css"],
})
export class SubscriptionsSwitch {
    private owner = inject(OwnerShopService);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    state = rxResource({ stream: () => this.owner.getSubscriptions() });

    enabled = () => (this.state.hasValue() ? this.state.value().enabled : false);

    // Le changement demandé : activer si éteint, désactiver si allumé
    saving = signal(false);
    notice = signal<{ ok: boolean; text: string } | null>(null);

    ask() {
        this.notice.set(null);
        this.dialog().nativeElement.showModal();
    }

    close() {
        this.dialog().nativeElement.close();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }

    async confirm() {
        const next = !this.enabled();
        this.saving.set(true);

        try {
            await firstValueFrom(this.owner.setSubscriptions(next));
            this.state.reload();
            this.close();
            this.notice.set({
                ok: true,
                text: next
                    ? "Les abonnements sont activés : les boutiques voient la page Abonnement."
                    : "Les abonnements sont désactivés : le logiciel est de nouveau totalement gratuit.",
            });
        } catch (err) {
            this.close();
            this.notice.set({
                ok: false,
                text:
                    (err as HttpErrorResponse).error?.message ??
                    "Le changement n'a pas pu être enregistré. Réessayez.",
            });
        } finally {
            this.saving.set(false);
        }
    }
}

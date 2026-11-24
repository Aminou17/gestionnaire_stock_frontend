import { Component, ElementRef, computed, input, output, signal, viewChild } from "@angular/core";

import { PaymentMethod } from "../../core/sales/sale.model";
import { Icon } from "../icon/icon";
import { FcfaPipe } from "../pipes/fcfa.pipe";

export interface PayChoice {
    method: PaymentMethod;
    amount: number;
    // espèces seulement : ce que le client a tendu, pour la monnaie
    received: number | null;
}

// Fenêtre d'encaissement d'un reste à payer, pour une vente comme pour un client.
// Elle vérifie le montant ; l'appelant envoie le paiement puis la ferme avec close().
@Component({
    selector: "app-pay-dialog",
    imports: [Icon, FcfaPipe],
    templateUrl: "./pay-dialog.html",
    styleUrls: ["../dialog/dialog.css", "./pay-dialog.css"],
})
export class PayDialog {
    title = input.required<string>();
    due = input.required<number>();
    busy = input(false);
    error = input<string | null>(null);
    confirmed = output<PayChoice>();

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    method = signal<PaymentMethod>("CASH");
    amount = signal<number | null>(null);
    received = signal<number | null>(null);
    formError = signal<string | null>(null);

    // en Afrique on pense en billets, pas en pourcentages : les coupures sous le reste, puis le solde
    quickAmounts = computed(() => {
        const notes = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
        return notes.filter((note) => note < this.due()).slice(-3);
    });

    // monnaie à rendre, seulement quand le client a donné un montant en espèces
    change = computed(() => {
        const received = this.received();
        const amount = this.amount();
        if (this.method() !== "CASH" || received === null || amount === null) return null;
        return received - amount;
    });

    open() {
        this.method.set("CASH");
        this.amount.set(this.due());
        this.received.set(null);
        this.formError.set(null);
        this.dialog().nativeElement.showModal();
    }

    // fermeture demandée par l'appelant, une fois le paiement enregistré
    close() {
        this.dialog().nativeElement.close();
    }

    // Annuler ou un clic à côté de la fenêtre : impossible pendant l'envoi
    cancel() {
        if (!this.busy()) this.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.cancel();
    }

    // Échap ne ferme pas la fenêtre pendant l'envoi
    onCancel(event: Event) {
        if (this.busy()) event.preventDefault();
    }

    readNumber(input: HTMLInputElement) {
        const value = Math.round(input.valueAsNumber);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    submit() {
        const amount = this.amount();
        if (amount === null || amount > this.due()) {
            this.formError.set(`Le montant doit être compris entre 1 et ${this.due()} F.`);
            return;
        }

        const received = this.received();
        if (this.method() === "CASH" && received !== null && received < amount) {
            this.formError.set(`Le montant reçu est inférieur à ${amount} F.`);
            return;
        }

        this.formError.set(null);
        this.confirmed.emit({ method: this.method(), amount, received });
    }
}

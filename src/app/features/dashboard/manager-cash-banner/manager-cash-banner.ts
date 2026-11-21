import { formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashSummary } from "../dashboard.model";
import { MoneyToggle } from "../../../shared/money/money-toggle";

// Bandeau de caisse de l'employé : état, solde et bouton "Nouvelle vente"
@Component({
    selector: "app-manager-cash-banner",
    imports: [MoneyToggle, RouterLink, FcfaPipe, Icon],
    templateUrl: "./manager-cash-banner.html",
    styleUrl: "./manager-cash-banner.css",
})
export class ManagerCashBanner {
    private locale = inject(LOCALE_ID);

    cash = input<CashSummary | null>(null);
    loading = input(false);
    error = input(false);
    // sa propre caisse d'un jour passé, pas clôturée : il faut la régler avant d'ouvrir
    previousOpen = input(false);
    retry = output();
    openCash = output();

    // une session clôturée aujourd'hui compte comme une caisse fermée
    isOpen = computed(() => this.cash()?.status === "OPEN");
    // clôturée aujourd'hui : la caisse ne se rouvre que le lendemain
    closedToday = computed(() => this.cash()?.status === "CLOSED");
    canSell = computed(() => !this.loading() && !this.error() && this.isOpen());

    openedAt = computed(() => {
        const cash = this.cash();
        if (!cash) return "";
        return formatDate(cash.openedAt, "HH:mm", this.locale);
    });
}

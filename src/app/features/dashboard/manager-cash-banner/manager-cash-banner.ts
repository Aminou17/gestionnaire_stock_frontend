import { formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashSummary } from "../../../core/cash/cash.model";
import { MoneyToggle } from "../../../shared/money/money-toggle";

// Bandeau de caisse de l'employé : état, solde et bouton "Nouvelle vente" (la caisse s'ouvre toute seule)
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
    // fond de départ annoncé tant que la caisse du jour n'existe pas
    expectedOpening = input<number | null>(null);
    retry = output();

    isOpen = computed(() => this.cash()?.status === "OPEN");
    // comptée aujourd'hui : une nouvelle vente la rouvre toute seule
    isCounted = computed(() => this.cash()?.status === "CLOSED");
    canSell = computed(() => !this.loading() && !this.error());

    openedAt = computed(() => {
        const cash = this.cash();
        if (!cash) return "";
        return formatDate(cash.openedAt, "HH:mm", this.locale);
    });
}

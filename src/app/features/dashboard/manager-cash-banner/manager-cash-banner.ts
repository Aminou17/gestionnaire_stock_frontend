import { formatDate } from "@angular/common";
import { Component, LOCALE_ID, computed, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashSummary } from "../dashboard.model";

// Bandeau de caisse du gérant : état, solde et bouton "Nouvelle vente"
@Component({
    selector: "app-manager-cash-banner",
    imports: [RouterLink, FcfaPipe, Icon],
    templateUrl: "./manager-cash-banner.html",
    styleUrl: "./manager-cash-banner.css",
})
export class ManagerCashBanner {
    private locale = inject(LOCALE_ID);

    cash = input<CashSummary | null>(null);
    loading = input(false);
    error = input(false);
    retry = output();

    // une session clôturée aujourd'hui compte comme une caisse fermée
    isOpen = computed(() => this.cash()?.status === "OPEN");
    canSell = computed(() => !this.loading() && !this.error() && this.isOpen());

    openedAt = computed(() => {
        const cash = this.cash();
        if (!cash) return "";
        return formatDate(cash.openedAt, "HH:mm", this.locale);
    });
}

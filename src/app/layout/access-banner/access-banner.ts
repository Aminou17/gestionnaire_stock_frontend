import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { Icon } from "../../shared/icon/icon";

// Rappel affiché 7 jours avant la fin, puis pendant les jours de grâce
const WARN_DAYS = 7;
const HIDDEN_KEY = "accessBannerHiddenOn";

const today = () => new Date().toISOString().slice(0, 10);

@Component({
    selector: "app-access-banner",
    imports: [RouterLink, Icon],
    templateUrl: "./access-banner.html",
    styleUrl: "./access-banner.css",
})
export class AccessBanner {
    private auth = inject(AuthService);

    // Masqué pour la journée ; pendant la grâce, il revient toujours
    private hiddenOn = signal(readHidden());

    protected banner = computed(() => {
        const access = this.auth.access();
        if (!access || access.daysLeft === null) return null;

        const days = access.daysLeft;
        const plural = days > 1 ? "s" : "";

        if (access.state === "grace") {
            return {
                tone: "danger" as const,
                text: this.auth.isAdmin()
                    ? `Votre accès a expiré. Il sera coupé dans ${days} jour${plural}.`
                    : `L'accès de la boutique sera coupé dans ${days} jour${plural}. Prévenez l'administrateur.`,
                dismissible: false,
            };
        }

        // Le rappel avant l'échéance ne concerne que celui qui paie
        if (
            (access.state === "trial" || access.state === "paid") &&
            days <= WARN_DAYS &&
            this.auth.isAdmin()
        ) {
            if (this.hiddenOn() === today()) return null;

            const what = access.state === "trial" ? "Votre essai gratuit" : "Votre abonnement";
            const when = days <= 1 ? "demain" : `dans ${days} jours`;
            return {
                tone: "warning" as const,
                text: `${what} se termine ${when}.`,
                dismissible: true,
            };
        }

        return null;
    });

    hide() {
        try {
            localStorage.setItem(HIDDEN_KEY, today());
        } catch {
            // Stockage indisponible : le bandeau se cache seulement jusqu'au rechargement
        }
        this.hiddenOn.set(today());
    }
}

function readHidden() {
    try {
        return localStorage.getItem(HIDDEN_KEY);
    } catch {
        return null;
    }
}

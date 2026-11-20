import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { whatsappLink } from "../../core/contact";
import { AuthService } from "../../core/auth/auth.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { IconName } from "../../shared/icon/icons";
import { WhatsappIcon } from "../../shared/icon/whatsapp-icon";

interface Plan {
    name: string;
    tagline: string;
    features: string[];
}

interface PaymentMethod {
    label: string;
    icon: IconName;
}

// aperçu seulement : aucun prix ni limite n'est encore décidé
const PLANS: Plan[] = [
    {
        name: "Essentiel",
        tagline: "Pour démarrer et tenir une boutique",
        features: ["Une boutique", "Ventes, caisse et stock", "Support par e-mail"],
    },
    {
        name: "Pro",
        tagline: "Pour une équipe qui grandit",
        features: ["Employés et rôles", "Support rapide"],
    },
    {
        name: "Entreprise",
        tagline: "Pour plusieurs points de vente",
        features: ["Plusieurs boutiques", "Équipe étendue", "Accompagnement dédié"],
    },
];

const PAYMENTS: PaymentMethod[] = [
    { label: "Mobile Money", icon: "phone" },
    { label: "Carte bancaire", icon: "wallet" },
];

import { getBackLink } from "../../core/back-link";
@Component({
    selector: "app-subscription",
    imports: [PageHeader, Icon, WhatsappIcon, RouterLink, DatePipe],
    templateUrl: "./subscription.html",
    styleUrl: "./subscription.css",
})
export class Subscription {
    // ouverte depuis les Paramètres ou le bandeau de fin d'essai
    protected back = getBackLink("/settings", "Paramètres");
    protected plans = PLANS;
    protected payments = PAYMENTS;
    protected whatsapp = whatsappLink();

    private auth = inject(AuthService);

    // état de l'accès donné par le serveur : essai, payé, délai de grâce ; null sans date de fin
    protected status = computed(() => {
        const access = this.auth.access();
        if (!access?.endsAt) return null;

        // endsAt est le premier instant sans accès : on affiche le dernier jour inclus
        const lastDay = new Date(new Date(access.endsAt).getTime() - 1000).toISOString();
        const days = access.state === "grace" ? 0 : Math.max(access.daysLeft ?? 0, 0);

        return {
            state: access.state,
            lastDay,
            days,
            graceDays: access.state === "grace" ? (access.daysLeft ?? 0) : 0,
            label:
                access.state === "paid"
                    ? "Abonnement actif"
                    : access.state === "grace"
                      ? "Échéance passée"
                      : "Essai gratuit",
        };
    });
}

import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { whatsappLink } from "../../core/contact";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
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

@Component({
    selector: "app-subscription",
    imports: [PageHeader, Icon, WhatsappIcon, RouterLink, DatePipe],
    templateUrl: "./subscription.html",
    styleUrl: "./subscription.css",
})
export class Subscription {
    protected plans = PLANS;
    protected payments = PAYMENTS;
    protected whatsapp = whatsappLink();

    private shop = inject(ShopSettingsService);

    // jours d'essai restants ; null quand la boutique n'a pas de date de fin
    protected trial = computed(() => {
        const endsAt = this.shop.trialEndsAt();
        if (!endsAt) return null;
        const days = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000);
        return { endsAt, days: Math.max(days, 0) };
    });
}

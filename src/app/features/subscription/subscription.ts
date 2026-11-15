import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

import { PRODUCT_NAME } from "../../core/brand";
import { whatsappLink } from "../../core/contact";
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
    imports: [PageHeader, Icon, WhatsappIcon, RouterLink],
    templateUrl: "./subscription.html",
    styleUrl: "./subscription.css",
})
export class Subscription {
    protected productName = PRODUCT_NAME;
    protected plans = PLANS;
    protected payments = PAYMENTS;
    protected whatsapp = whatsappLink();
}

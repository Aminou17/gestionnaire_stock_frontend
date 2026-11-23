import { Injectable, computed, inject, signal } from "@angular/core";

// Accès que le propriétaire peut retirer à une boutique (voir config/modules.js côté API)
export type ModuleKey =
    | "customers"
    | "expenses"
    | "report"
    | "inventories"
    | "purchases"
    | "alerts_pro"
    | "team"
    | "audit"
    | "exports";

// ce que la boutique lit quand une fonction n'est pas dans sa formule (mêmes noms que côté API)
export const MODULE_INFO: Record<ModuleKey, { label: string; description: string }> = {
    customers: {
        label: "Dettes et clients",
        description: "Suivre les clients, leurs achats et ce qu'ils doivent.",
    },
    expenses: {
        label: "Dépenses",
        description: "Noter les dépenses payées avec l'argent de la caisse.",
    },
    report: { label: "Bilan", description: "Bénéfice net, ventes et dépenses sur une période." },
    inventories: {
        label: "Inventaires",
        description: "Compter le stock réel et corriger les écarts.",
    },
    purchases: { label: "Achats", description: "Fournisseurs et entrées de stock." },
    alerts_pro: {
        label: "Commandes et vitesse de vente",
        description:
            "Vitesse de vente, bons de commande par fournisseur et e-mail d'alerte chaque matin.",
    },
    team: {
        label: "Équipe",
        description: "Créer des comptes pour les vendeurs et gérer leurs accès.",
    },
    audit: { label: "Historique des actions", description: "Voir qui a fait quoi, et quand." },
    exports: {
        label: "Sauvegarde et export",
        description: "Télécharger ses produits, ses ventes et ses mouvements.",
    },
};

// pages de l'application liées à un accès ; les plus précises d'abord
const ROUTE_MODULES: [string, ModuleKey][] = [
    ["/customers", "customers"],
    ["/expenses", "expenses"],
    ["/admin", "report"],
    ["/inventories", "inventories"],
    ["/suppliers", "purchases"],
    ["/stock-entries", "purchases"],
    ["/alerts/rotation", "alerts_pro"],
    ["/alerts/supplier", "alerts_pro"],
    ["/settings/alert-email", "alerts_pro"],
    ["/users", "team"],
    ["/audit-logs", "audit"],
    ["/settings/export", "exports"],
];

// l'accès dont dépend une page, ou null si la page est toujours incluse
export const moduleOfPath = (path: string): ModuleKey | null => {
    const clean = path.split(/[?#]/)[0];
    return (
        ROUTE_MODULES.find(([prefix]) => clean === prefix || clean.startsWith(prefix + "/"))?.[1] ??
        null
    );
};

// Ce que la boutique connaît de son offre, rempli quand ses réglages arrivent (voir ShopSettingsService).
// Séparé du service des réglages pour que les écrans qui testent un accès n'aient rien à charger.
@Injectable({ providedIn: "root" })
export class ModuleStore {
    // accès retirés à la boutique
    disabled = signal<string[]>([]);
    // la page Abonnement est ouverte
    subscriptions = signal(false);
    // les réglages sont arrivés (ou ont échoué) : les gardes peuvent décider
    ready = signal(false);
    // fonction que la personne vient d'essayer d'ouvrir sans l'avoir : le message d'abonnement s'affiche
    locked = signal<ModuleKey | null>(null);
}

// Ce que la boutique peut utiliser : tout, sauf ce que le propriétaire a retiré
@Injectable({ providedIn: "root" })
export class ModuleAccess {
    private store = inject(ModuleStore);

    private disabled = computed(() => new Set<string>(this.store.disabled()));

    allows(key: ModuleKey) {
        return !this.disabled().has(key);
    }

    // la fonction à laquelle une page donne accès quand la boutique ne l'a pas, sinon null
    lockedKey(path: string | undefined): ModuleKey | null {
        if (!path) return null;
        const key = moduleOfPath(path.startsWith("/") ? path : `/settings/${path}`);
        return key !== null && !this.allows(key) ? key : null;
    }

    isLocked(path: string | undefined) {
        return this.lockedKey(path) !== null;
    }

    // affiche le message « disponible avec l'abonnement » pour cette fonction
    showLocked(key: ModuleKey) {
        this.store.locked.set(key);
    }

    // une page sans accès particulier est toujours permise ; avec une adresse relative des réglages
    // ("export"), on la complète
    allowsPath(path: string | undefined) {
        if (!path) return true;
        const full = path.startsWith("/") ? path : `/settings/${path}`;
        const key = moduleOfPath(full);
        return key === null || this.allows(key);
    }
}

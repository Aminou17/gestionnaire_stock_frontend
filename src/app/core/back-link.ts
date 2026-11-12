import { inject } from "@angular/core";
import { Router } from "@angular/router";

// état transmis par la page d'origine avec [state] ou navigate(..., { state })
export interface BackState {
    backTo: string;
    backLabel: string;
}

// Lien Retour d'une fiche : la page d'où l'on vient si elle l'a indiqué, sinon la liste habituelle.
// À appeler dans le constructeur ou un champ du composant.
export const getBackLink = (fallbackUrl: string, fallbackLabel: string) => {
    const router = inject(Router);
    // pendant la navigation l'état est dans la navigation en cours, après un rechargement dans l'historique
    const state = router.currentNavigation()?.extras.state ?? history.state;
    const fromState = typeof state?.backTo === "string" && state.backTo.startsWith("/");

    return {
        link: router.parseUrl(fromState ? state.backTo : fallbackUrl),
        label: fromState && typeof state.backLabel === "string" ? state.backLabel : fallbackLabel,
    };
};

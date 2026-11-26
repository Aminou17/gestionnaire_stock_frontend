import { inject } from "@angular/core";
import { Router } from "@angular/router";

// État transmis par la page d'origine avec [state] ou avec navigate et son option state
export interface BackState {
    backTo: string;
    backLabel: string;
}

// Lien Retour d'une fiche : la page d'où l'on vient si elle l'a indiqué, sinon la page précédente
// (bouton Vendre, recherche, tableau de bord), sinon la liste habituelle.
// À appeler dans le constructeur ou un champ du composant.
export const getBackLink = (fallbackUrl: string, fallbackLabel: string) => {
    const router = inject(Router);
    // Pendant la navigation l'état est dans la navigation en cours, après un rechargement dans l'historique
    const state = router.currentNavigation()?.extras.state ?? history.state;
    const fromState = typeof state?.backTo === "string" && state.backTo.startsWith("/");

    const previous = fromState ? null : previousPage(router);

    return {
        link: router.parseUrl(fromState ? state.backTo : (previous ?? fallbackUrl)),
        label:
            fromState && typeof state.backLabel === "string"
                ? state.backLabel
                : previous && !isSamePage(previous, fallbackUrl)
                  ? "Retour"
                  : fallbackLabel,
    };
};

// La page d'où l'on vient est la liste habituelle : on garde son libellé précis
const isSamePage = (url: string, fallbackUrl: string) =>
    url.split("?")[0] === fallbackUrl.split("?")[0];

// La page visitée juste avant, sauf un formulaire de création, l'accueil ou la page elle-même
const previousPage = (router: Router) => {
    const navigation = router.currentNavigation();
    const previous = navigation?.previousNavigation?.finalUrl;
    if (!previous) return null;

    const url = router.serializeUrl(previous);
    const path = (value: string) => value.split("?")[0];
    const current = navigation?.finalUrl ? path(router.serializeUrl(navigation.finalUrl)) : null;

    if (url === "/" || path(url) === current || /\/new(\?|$)|^\/login/.test(url)) return null;
    return url;
};

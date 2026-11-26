import { Location } from "@angular/common";
import { Directive, computed, inject, input } from "@angular/core";
import { Router, UrlTree } from "@angular/router";

// Retour comme une vraie application : si la page visée est celle d'où l'on vient, on recule
// dans l'historique (la touche retour du téléphone reste cohérente) ; sinon elle remplace la page actuelle.
// À appeler dans le constructeur ou un champ du composant.
export const injectGoBack = () => {
    const router = inject(Router);
    const location = inject(Location);

    return (target: string | UrlTree) => {
        const url = typeof target === "string" ? target : router.serializeUrl(target);
        const previous = router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl;

        if (previous && router.serializeUrl(previous) === url) {
            location.back();
            return;
        }
        router.navigateByUrl(url, { replaceUrl: true });
    };
};

// Lien "Retour" : garde une vraie adresse (clic du milieu, survol) mais recule avec injectGoBack
@Directive({
    selector: "a[appBackLink]",
    host: {
        "[attr.href]": "href()",
        "(click)": "onClick($event)",
    },
})
export class BackLink {
    private router = inject(Router);
    private goBack = injectGoBack();

    readonly target = input.required<string | UrlTree>({ alias: "appBackLink" });

    protected href = computed(() => {
        const target = this.target();
        return typeof target === "string" ? target : this.router.serializeUrl(target);
    });

    protected onClick(event: MouseEvent) {
        // Nouvel onglet ou nouvelle fenêtre : on laisse faire le navigateur
        if (
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        event.preventDefault();
        this.goBack(this.target());
    }
}

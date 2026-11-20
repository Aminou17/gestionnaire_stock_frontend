import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import { NavigationStart, Router } from "@angular/router";
import { SwUpdate } from "@angular/service-worker";
import { filter } from "rxjs";

// vérifier s'il existe une nouvelle version toutes les 30 minutes
const CHECK_EVERY = 30 * 60 * 1000;

// L'application garde une copie d'elle-même sur l'appareil pour marcher sans internet.
// Sans ce service, une nouvelle version mise en ligne restait téléchargée mais jamais affichée.
// Ici : on cherche les mises à jour, et dès qu'une version est prête, on bascule au
// prochain changement de page (rechargement complet, aucune saisie en cours n'est perdue).
@Injectable({ providedIn: "root" })
export class AppUpdateService {
    // absent quand le service worker n'est pas fourni (tests)
    private sw = inject(SwUpdate, { optional: true });
    private router = inject(Router);
    private document = inject(DOCUMENT);

    private ready = false;

    start() {
        const sw = this.sw;
        if (!sw?.isEnabled) return;

        sw.versionUpdates
            .pipe(filter((event) => event.type === "VERSION_READY"))
            .subscribe(() => (this.ready = true));

        // copie abîmée sur l'appareil : on repart de la version en ligne
        sw.unrecoverable.subscribe(() => this.document.location.reload());

        this.router.events
            .pipe(filter((event) => event instanceof NavigationStart))
            .subscribe((event) => {
                if (!this.ready) return;
                this.ready = false;
                sw.activateUpdate()
                    .then(() => this.document.location.assign(event.url))
                    .catch(() => {});
            });

        // au retour sur l'application et à intervalle régulier
        this.document.addEventListener("visibilitychange", () => {
            if (this.document.visibilityState === "visible") this.check();
        });
        setInterval(() => this.check(), CHECK_EVERY);
        this.check();
    }

    private check() {
        // le service worker n'est pas encore installé, ou pas d'internet : on réessaiera
        this.sw?.checkForUpdate().catch(() => {});
    }
}

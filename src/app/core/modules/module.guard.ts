import { inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { CanActivateChildFn, CanActivateFn, Router } from "@angular/router";
import { filter, firstValueFrom, of, take, timeout } from "rxjs";

import { ShopSettingsService } from "../shop/shop-settings.service";
import { ModuleAccess, ModuleStore, moduleOfPath } from "./module-access";

// les réglages de la boutique arrivent après la connexion : on les attend un instant avant de décider
// (injecter le service des réglages suffit à lancer leur chargement)
const settingsReady = () => {
    inject(ShopSettingsService);

    return firstValueFrom(
        toObservable(inject(ModuleStore).ready).pipe(
            filter(Boolean),
            take(1),
            timeout({ first: 4000, with: () => of(true) }),
        ),
    );
};

// Une fonction hors de la formule de la boutique reste visible : au clic, on explique qu'elle fait partie de
// l'abonnement. En cours d'utilisation on reste sur la page ; sur une adresse tapée ou ouverte au démarrage,
// on va à l'accueil.
// (tout est demandé avant le premier await : après, on ne peut plus injecter)
export const moduleGuard: CanActivateChildFn = async (_route, state) => {
    const key = moduleOfPath(state.url);
    if (key === null) return true;

    const access = inject(ModuleAccess);
    const router = inject(Router);
    const home = router.createUrlTree(["/dashboard"]);
    const started = router.navigated;

    await settingsReady();

    if (access.allows(key)) return true;

    access.showLocked(key);
    return started ? false : home;
};

// La page Abonnement n'existe que lorsque le propriétaire a activé les abonnements
export const subscriptionGuard: CanActivateFn = async () => {
    const store = inject(ModuleStore);
    const home = inject(Router).createUrlTree(["/dashboard"]);

    await settingsReady();

    return store.subscriptions() || home;
};

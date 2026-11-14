import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// Pages d'une boutique : le propriétaire n'en a pas, il va vers la liste des boutiques
export const shopGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isOwner() ? inject(Router).createUrlTree(["/owner"]) : true;
};

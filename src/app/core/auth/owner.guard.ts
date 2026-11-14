import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// Espace du propriétaire : une personne d'une boutique est renvoyée vers ses propres pages
export const ownerGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isOwner() ? true : inject(Router).createUrlTree(["/dashboard"]);
};

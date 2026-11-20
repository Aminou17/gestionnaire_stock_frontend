import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// essai ou abonnement terminé : les pages de la boutique laissent place à l'écran qui explique la suite
export const accessGuard: CanActivateFn = () => {
    const access = inject(AuthService).access();
    return access?.blocked ? inject(Router).createUrlTree(["/access-ended"]) : true;
};

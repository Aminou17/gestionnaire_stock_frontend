import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// Pages réservées à l'admin : le manager est renvoyé au tableau de bord
export const adminGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isAdmin() ? true : inject(Router).createUrlTree(["/dashboard"]);
};

import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// Pages réservées à l'admin : le manager est renvoyé au tableau de bord, qui lui explique pourquoi
export const adminGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isAdmin()
        ? true
        : inject(Router).createUrlTree(["/dashboard"], { queryParams: { reserved: 1 } });
};

import { inject } from "@angular/core";
import { CanActivateChildFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

// Avec un mot de passe provisoire, la seule page ouverte est celle où on le change
export const passwordChangeGuard: CanActivateChildFn = (_route, state) => {
    const auth = inject(AuthService);

    if (!auth.user()?.mustChangePassword || state.url.split("?")[0] === "/settings/password") {
        return true;
    }

    return inject(Router).createUrlTree(["/settings/password"]);
};

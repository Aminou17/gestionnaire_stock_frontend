import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { Observable, catchError, switchMap, throwError } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "./auth.service";
import { isUnreachable } from "../offline/network.interceptor";

// Routes qui n'ont pas besoin du jeton, ou qui servent à l'obtenir
const PUBLIC_AUTH =
    /\/auth\/(login|register|refresh|logout|verify-email|resend-code|forgot-password|reset-password|phone-available)$/;

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    // Le token ne part que vers notre API, jamais vers un autre domaine
    const isApi = req.url.startsWith(API_URL);

    if (!isApi || PUBLIC_AUTH.test(req.url.split("?")[0])) return next(req);

    const canRefresh = !!auth.refreshToken;

    // Jeton expiré : on le renouvelle d'abord avec la session de 30 jours de l'appareil
    if (auth.token && auth.tokenExpired() && canRefresh) {
        return renewed(auth, (token) => send(req, next, auth, token, false));
    }

    return send(req, next, auth, auth.token, canRefresh);
};

// Renouvelle le jeton puis relance la requête ; une session refusée déconnecte, une coupure réseau non
function renewed<T>(auth: AuthService, then: (token: string) => Observable<T>) {
    return auth.refresh().pipe(
        catchError((error: HttpErrorResponse) => {
            if (!isUnreachable(error.status)) auth.logout();
            return throwError(() => error);
        }),
        switchMap(then),
    );
}

function send(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
    auth: AuthService,
    token: string | null,
    retryOn401: boolean,
): Observable<HttpEvent<unknown>> {
    return next(withToken(req, token)).pipe(
        catchError((error: HttpErrorResponse) => {
            // Jeton refusé (horloge décalée, jeton ancien) : un seul renouvellement puis on réessaie
            if (error.status === 401 && retryOn401) {
                return renewed(auth, (fresh) => send(req, next, auth, fresh, false));
            }

            if (error.status === 401) auth.logout();

            if (error.status === 403 && error.error?.code === "PASSWORD_CHANGE_REQUIRED") {
                auth.requirePasswordChange();
            }

            if (error.status === 402 && error.error?.code === "ACCESS_ENDED") {
                auth.markAccessEnded();
            }

            return throwError(() => error);
        }),
    );
}

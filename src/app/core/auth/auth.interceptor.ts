import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "./auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const token = auth.token;
    // le token ne part que vers notre API, jamais vers un autre domaine
    const isApi = req.url.startsWith(API_URL);
    const isLogin = req.url.endsWith("/auth/login");

    const request =
        token && isApi && !isLogin
            ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
            : req;

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401 && isApi && !isLogin) {
                auth.logout();
            }
            if (error.status === 403 && isApi && error.error?.code === "PASSWORD_CHANGE_REQUIRED") {
                auth.requirePasswordChange();
            }
            return throwError(() => error);
        }),
    );
};

import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import { NetworkService } from "./network.service";

// chaque réponse du serveur dit s'il est joignable : le bandeau "hors ligne" suit la réalité
export const networkInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(API_URL)) return next(req);

    const network = inject(NetworkService);

    return next(req).pipe(
        tap({
            next: (event) => {
                if (event instanceof HttpResponse) network.markReachable();
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === 0) network.markUnreachable();
                else network.markReachable();
            },
        }),
    );
};

import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import { NetworkService } from "./network.service";

// sans réseau, le service worker répond 504 à la place du serveur ; 502 et 503 viennent de l'hébergeur
// quand l'API ne répond pas (réveil, déploiement) : dans tous ces cas on vend comme hors ligne
const UNREACHABLE = [0, 502, 503, 504];

export const isUnreachable = (status: number) => UNREACHABLE.includes(status);

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
                if (isUnreachable(error.status)) network.markUnreachable();
                else network.markReachable();
            },
        }),
    );
};

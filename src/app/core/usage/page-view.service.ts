import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { EMPTY, catchError, filter } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";

// Compte les pages ouvertes par les administrateurs et les vendeurs : seulement le chemin de la page,
// jamais ce qui est saisi. Le propriétaire du logiciel les voit par boutique et par jour.
@Injectable({ providedIn: "root" })
export class PageViewService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private auth = inject(AuthService);

    private last = "";

    start() {
        this.router.events
            .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
            .subscribe((event) => this.record(event.urlAfterRedirects));
    }

    private record(url: string) {
        if (!this.auth.isLoggedIn() || this.auth.isOwner()) return;

        // Sans les paramètres de l'adresse : ils peuvent contenir un nom ou un numéro
        const page = url.split(/[?#]/)[0];
        // Un rafraîchissement de la même page ne compte pas deux fois de suite
        if (page === this.last) return;
        this.last = page;

        this.http
            .post(`${API_URL}/usage/page`, { page })
            .pipe(catchError(() => EMPTY))
            .subscribe();
    }
}

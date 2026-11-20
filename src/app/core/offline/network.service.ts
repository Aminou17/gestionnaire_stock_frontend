import { Injectable, signal } from "@angular/core";

// Connexion de l'appareil. Le navigateur dit « en ligne » dès qu'il a un réseau,
// même sans accès réel à internet : un appel qui échoue sans réponse (status 0) le corrige.
@Injectable({ providedIn: "root" })
export class NetworkService {
    readonly online = signal(typeof navigator === "undefined" ? true : navigator.onLine);

    constructor() {
        if (typeof window === "undefined") return;
        window.addEventListener("online", () => this.online.set(true));
        window.addEventListener("offline", () => this.online.set(false));
    }

    // un appel au serveur est resté sans réponse
    markUnreachable() {
        this.online.set(false);
    }

    // un appel a reçu une réponse : le serveur est joignable
    markReachable() {
        if (!this.online()) this.online.set(true);
    }
}

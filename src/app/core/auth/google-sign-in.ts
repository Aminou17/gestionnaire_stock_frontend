import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { API_URL } from "../api.config";

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

export type GoogleButtonText = "signin_with" | "signup_with" | "continue_with";

interface GoogleId {
    initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
    }): void;
    renderButton(host: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleId } };
    }
}

// Charge le script de Google et l'identifiant de l'application, une seule fois
@Injectable({ providedIn: "root" })
export class GoogleSignIn {
    private http = inject(HttpClient);
    private ready: Promise<GoogleId | null> | null = null;
    private callback: (credential: string) => void = () => {};

    // null : la connexion avec Google n'est pas configurée ou Google est injoignable
    load(): Promise<GoogleId | null> {
        this.ready ??= this.start().catch(() => null);
        return this.ready;
    }

    // Le bouton affiché le plus récemment reçoit la réponse de Google
    onCredential(callback: (credential: string) => void) {
        this.callback = callback;
    }

    private async start() {
        const { clientId } = await firstValueFrom(
            this.http.get<{ clientId: string | null }>(`${API_URL}/auth/google/config`),
        );
        if (!clientId) return null;

        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = SCRIPT_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Script Google introuvable"));
            document.head.appendChild(script);
        });

        const id = window.google?.accounts.id ?? null;
        id?.initialize({
            client_id: clientId,
            callback: (response) => this.callback(response.credential),
        });
        return id;
    }
}

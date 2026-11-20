import { Injectable, signal } from "@angular/core";

// Chrome n'envoie « installation possible » qu'une fois, au chargement de la page :
// on l'écoute dès le démarrage (main.ts), avant que le menu du profil n'existe.
let earlyPrompt: any = null;
const earlyListeners: Array<(event: any) => void> = [];

export function listenInstallPrompt(win: Window = window) {
    win.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        earlyPrompt = event;
        earlyListeners.forEach((listener) => listener(event));
    });
}

// Installer l'application : fenêtre du navigateur quand il le permet (Chrome, Edge),
// sinon on explique le geste selon l'appareil. Proposé dans le menu du profil et sur Mon profil.
@Injectable({ providedIn: "root" })
export class InstallService {
    private prompt: any = earlyPrompt;

    readonly canInstall = signal(earlyPrompt !== null);
    private installed = signal(this.isInstalled());

    constructor() {
        earlyListeners.push((event) => {
            this.prompt = event;
            this.canInstall.set(true);
        });

        window.addEventListener("appinstalled", () => {
            this.prompt = null;
            this.canInstall.set(false);
            this.installed.set(true);
        });
    }

    // visible tant que Boutiki n'est pas déjà ouvert comme une application installée
    get available() {
        return !this.installed();
    }

    // le geste à faire quand le navigateur ne propose pas sa propre fenêtre
    get hint() {
        const ua = window.navigator.userAgent;
        if (/iphone|ipad|ipod/i.test(ua)) {
            return "Dans Safari, touchez Partager, puis « Sur l'écran d'accueil »";
        }
        if (/android/i.test(ua)) {
            return "Ouvrez le menu ⋮ du navigateur, puis « Ajouter à l'écran d'accueil »";
        }
        if (/firefox/i.test(ua)) {
            return "Firefox n'installe pas les applications : ouvrez Boutiki dans Chrome ou Edge";
        }
        return "Cliquez sur l'icône d'installation à droite de la barre d'adresse";
    }

    async install() {
        if (!this.prompt) return;
        this.prompt.prompt();
        await this.prompt.userChoice;
        this.prompt = null;
        this.canInstall.set(false);
    }

    private isInstalled() {
        return (
            window.matchMedia?.("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true
        );
    }
}

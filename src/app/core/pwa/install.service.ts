import { Injectable, signal } from "@angular/core";

// Le navigateur propose l'installation de l'application (Android, Chrome) ou on explique comment faire (iPhone).
// Proposée dans le menu du profil et sur la page Mon profil, plus dans une bannière qui cachait le bas des pages.
@Injectable({ providedIn: "root" })
export class InstallService {
    private prompt: any = null;

    readonly canInstall = signal(false);
    readonly showIosHint = signal(false);

    constructor() {
        if (this.isInstalled()) return;

        window.addEventListener("beforeinstallprompt", (event) => {
            event.preventDefault();
            this.prompt = event;
            this.canInstall.set(true);
        });

        window.addEventListener("appinstalled", () => {
            this.prompt = null;
            this.canInstall.set(false);
            this.showIosHint.set(false);
        });

        const ua = window.navigator.userAgent;
        const isIos = /iphone|ipad|ipod/i.test(ua);
        const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua);
        this.showIosHint.set(isIos && isSafari);
    }

    // vrai quand l'application n'est pas encore installée et que le navigateur le permet
    get available() {
        return this.canInstall() || this.showIosHint();
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

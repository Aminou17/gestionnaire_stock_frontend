import { Injectable, signal } from "@angular/core";

const DISMISSED_KEY = "install-banner-dismissed";

// Le navigateur propose l'installation de l'application (Android, Chrome) ou on explique comment faire (iPhone)
@Injectable({ providedIn: "root" })
export class InstallService {
    private prompt: any = null;
    private dismissed = signal(this.readDismissed());

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

    get visible() {
        return !this.dismissed() && (this.canInstall() || this.showIosHint());
    }

    async install() {
        if (!this.prompt) return;
        this.prompt.prompt();
        await this.prompt.userChoice;
        this.prompt = null;
        this.canInstall.set(false);
    }

    dismiss() {
        this.dismissed.set(true);
        try {
            localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
            // stockage bloqué : la bannière reviendra à la prochaine visite
        }
    }

    private isInstalled() {
        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true
        );
    }

    private readDismissed() {
        try {
            return localStorage.getItem(DISMISSED_KEY) === "1";
        } catch {
            return false;
        }
    }
}

import { Component, computed, inject, signal } from "@angular/core";

import { getBackLink } from "../../../core/back-link";
import { PRODUCT_NAME } from "../../../core/brand";
import { InstallService } from "../../../core/pwa/install.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { ToastService } from "../../../shared/toast/toast.service";

// Page "Installer Boutiki" : le bouton quand le navigateur le propose, sinon les gestes pas à pas
@Component({
    selector: "app-settings-install",
    imports: [PageHeader, Icon],
    templateUrl: "./settings-install.html",
    styleUrl: "./settings-install.css",
})
export class SettingsInstall {
    protected pwa = inject(InstallService);
    private toast = inject(ToastService);

    protected back = getBackLink("/settings", "Retour aux paramètres");
    protected productName = PRODUCT_NAME;

    // l'application Android, servie par le site lui-même (voir public/boutiki.apk)
    protected apk = { url: "/boutiki.apk", version: "1.1.0", size: "3 Mo" };

    protected platform = this.pwa.platform;
    protected inApp = this.pwa.inAppBrowser;
    protected installed = this.pwa.isInstalled$;
    protected busy = signal(false);

    // adresse à ouvrir dans le navigateur
    protected address = window.location.origin;

    // les gestes selon l'appareil, quand la fenêtre d'installation n'est pas proposée
    protected steps = computed(() => {
        if (this.platform === "ios") {
            return [
                "Ouvrez Boutiki dans Safari (pas dans une autre application).",
                "Touchez le bouton Partager, en bas de l'écran.",
                "Choisissez « Sur l'écran d'accueil », puis « Ajouter ».",
            ];
        }
        if (this.platform === "android") {
            return [
                "Ouvrez Boutiki dans Chrome.",
                "Touchez le menu ⋮ en haut à droite.",
                "Choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »), puis « Installer ».",
            ];
        }
        return [
            "Ouvrez Boutiki dans Chrome ou Edge.",
            "Cliquez sur l'icône d'installation, à droite de la barre d'adresse.",
            "Confirmez avec « Installer ».",
        ];
    });

    async install() {
        this.busy.set(true);
        const accepted = await this.pwa.install();
        this.busy.set(false);
        if (accepted) this.toast.show(`${this.productName} est installé`);
    }

    async copyAddress() {
        try {
            await navigator.clipboard.writeText(this.address);
            this.toast.show("Adresse copiée : collez-la dans Chrome");
        } catch {
            this.toast.show(this.address, 6000);
        }
    }
}

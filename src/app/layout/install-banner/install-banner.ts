import { Component, inject } from "@angular/core";

import { InstallService } from "../../core/pwa/install.service";
import { PRODUCT_NAME } from "../../core/brand";

@Component({
    selector: "app-install-banner",
    template: `
        @if (pwa.visible) {
            <aside class="install" role="region" aria-label="Installer l'application">
                <img src="icons/icon-192.png" alt="" width="40" height="40" />
                <div class="text">
                    <strong>Installer {{ name }}</strong>
                    @if (pwa.canInstall()) {
                        <span>Ouvre l'application en un geste, comme sur le téléphone.</span>
                    } @else {
                        <span>Touchez Partager, puis "Sur l'écran d'accueil".</span>
                    }
                </div>
                @if (pwa.canInstall()) {
                    <button type="button" class="btn btn-primary" (click)="pwa.install()">
                        Installer
                    </button>
                }
                <button type="button" class="close" (click)="pwa.dismiss()" aria-label="Plus tard">
                    Plus tard
                </button>
            </aside>
        }
    `,
    styleUrl: "./install-banner.css",
})
export class InstallBanner {
    protected pwa = inject(InstallService);
    protected name = PRODUCT_NAME;
}

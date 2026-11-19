import { Component, inject } from "@angular/core";

import { InstallService } from "../../core/pwa/install.service";
import { PRODUCT_NAME } from "../../core/brand";
import { Icon } from "../../shared/icon/icon";

// Petite barre d'une ligne : elle ne doit pas cacher le bas des pages
@Component({
    selector: "app-install-banner",
    imports: [Icon],
    template: `
        @if (pwa.visible) {
            <aside class="install" role="region" aria-label="Installer l'application">
                <img src="icons/icon-192.png" alt="" width="32" height="32" />
                <div class="text">
                    <strong>Installer {{ name }}</strong>
                    @if (pwa.canInstall()) {
                        <span>Accès en un geste</span>
                    } @else {
                        <span>Partager, puis « Sur l'écran d'accueil »</span>
                    }
                </div>
                @if (pwa.canInstall()) {
                    <button type="button" class="btn btn-primary btn-sm" (click)="pwa.install()">
                        Installer
                    </button>
                }
                <button type="button" class="close" (click)="pwa.dismiss()" aria-label="Plus tard">
                    <app-icon name="close" [size]="18" />
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

import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LayoutService } from "../layout.service";
import { LogoutDialog } from "../../shared/logout-dialog/logout-dialog";
import { BottomNav } from "../bottom-nav/bottom-nav";
import { Search } from "../search/search";
import { Sidebar } from "../sidebar/sidebar";
import { Toast } from "../../shared/toast/toast";
import { FeatureLocked } from "../feature-locked/feature-locked";
import { AccessBanner } from "../access-banner/access-banner";
import { OfflineBanner } from "../offline-banner/offline-banner";
import { NetworkService } from "../../core/offline/network.service";
import { OfflineCatalogService } from "../../core/offline/offline-catalog.service";
import { SaleOutboxService } from "../../core/offline/sale-outbox.service";

@Component({
    selector: "app-main-layout",
    imports: [
        RouterOutlet,
        Sidebar,
        BottomNav,
        Search,
        LogoutDialog,
        Toast,
        AccessBanner,
        OfflineBanner,
        FeatureLocked,
    ],
    template: `
        <app-sidebar />
        <main [class.collapsed]="layout.collapsed()">
            <app-offline-banner />
            <app-access-banner />
            <router-outlet />
        </main>
        <app-bottom-nav />
        <app-search />
        <app-logout-dialog />
        <app-feature-locked />
        <app-toast />
    `,
    styleUrl: "./main-layout.css",
})
export class MainLayout implements OnInit {
    private auth = inject(AuthService);
    protected layout = inject(LayoutService);
    // démarre l'envoi automatique des ventes faites sans internet
    private outbox = inject(SaleOutboxService);

    private catalog = inject(OfflineCatalogService);
    private network = inject(NetworkService);

    ngOnInit() {
        // une 401 est déjà gérée par l'intercepteur
        this.auth.refreshUser().subscribe({ error: () => {} });

        // catalogue gardé dès l'ouverture : la vente marche même si la coupure arrive avant
        if (!this.auth.isOwner() && this.network.online()) {
            void this.catalog.load().then(() => {
                this.catalog.refresh().catch(() => {});
            });
        }
    }
}

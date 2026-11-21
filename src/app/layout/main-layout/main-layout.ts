import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LayoutService } from "../layout.service";
import { LogoutDialog } from "../../shared/logout-dialog/logout-dialog";
import { BottomNav } from "../bottom-nav/bottom-nav";
import { Search } from "../search/search";
import { Sidebar } from "../sidebar/sidebar";
import { Toast } from "../../shared/toast/toast";
import { AccessBanner } from "../access-banner/access-banner";
import { OfflineBanner } from "../offline-banner/offline-banner";
import { CashSessionService } from "../../core/cash/cash-session.service";
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
    private cashService = inject(CashSessionService);

    ngOnInit() {
        // une 401 est déjà gérée par l'intercepteur
        this.auth.refreshUser().subscribe({ error: () => {} });

        // catalogue et état de la caisse gardés dès l'ouverture : la vente marche même si la coupure
        // arrive avant qu'on ait ouvert la caisse
        if (!this.auth.isOwner() && this.network.online()) {
            void this.catalog.load().then(() => {
                this.catalog.refresh().catch(() => {});
                this.cashService.getTodayCash().subscribe({
                    next: (cash) =>
                        void this.catalog.saveCash(
                            cash
                                ? {
                                      status: cash.status,
                                      sessionDate: cash.openedAt?.slice(0, 10) ?? null,
                                  }
                                : null,
                        ),
                    error: () => {},
                });
            });
        }
    }
}

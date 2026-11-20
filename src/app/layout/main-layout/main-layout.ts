import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LayoutService } from "../layout.service";
import { LogoutDialog } from "../../shared/logout-dialog/logout-dialog";
import { BottomNav } from "../bottom-nav/bottom-nav";
import { InstallBanner } from "../install-banner/install-banner";
import { Search } from "../search/search";
import { Sidebar } from "../sidebar/sidebar";
import { Toast } from "../../shared/toast/toast";

@Component({
    selector: "app-main-layout",
    imports: [RouterOutlet, Sidebar, BottomNav, Search, LogoutDialog, InstallBanner, Toast],
    template: `
        <app-sidebar />
        <main [class.collapsed]="layout.collapsed()">
            <router-outlet />
        </main>
        <app-bottom-nav />
        <app-search />
        <app-logout-dialog />
        <app-install-banner />
        <app-toast />
    `,
    styleUrl: "./main-layout.css",
})
export class MainLayout implements OnInit {
    private auth = inject(AuthService);
    protected layout = inject(LayoutService);

    ngOnInit() {
        // une 401 est déjà gérée par l'intercepteur
        this.auth.refreshUser().subscribe({ error: () => {} });
    }
}

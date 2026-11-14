import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LayoutService } from "../layout.service";
import { BottomNav } from "../bottom-nav/bottom-nav";
import { RevealDialog } from "../../shared/secret/reveal-dialog";
import { Search } from "../search/search";
import { Sidebar } from "../sidebar/sidebar";

@Component({
    selector: "app-main-layout",
    imports: [RouterOutlet, Sidebar, BottomNav, Search, RevealDialog],
    template: `
        <app-sidebar />
        <main [class.collapsed]="layout.collapsed()">
            <router-outlet />
        </main>
        <app-bottom-nav />
        <app-search />
        <app-reveal-dialog />
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

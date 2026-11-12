import { Component, OnInit, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { BottomNav } from "../bottom-nav/bottom-nav";
import { Sidebar } from "../sidebar/sidebar";

@Component({
    selector: "app-main-layout",
    imports: [RouterOutlet, Sidebar, BottomNav],
    template: `
        <app-sidebar />
        <main>
            <router-outlet />
        </main>
        <app-bottom-nav />
    `,
    styleUrl: "./main-layout.css",
})
export class MainLayout implements OnInit {
    private auth = inject(AuthService);

    ngOnInit() {
        // une 401 est déjà gérée par l'intercepteur
        this.auth.refreshUser().subscribe({ error: () => {} });
    }
}

import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { SupportService } from "../../../core/support/support.service";
import { Icon } from "../../../shared/icon/icon";
import { OwnerShopService } from "../owner-shop.service";
import { SecurityService } from "../security/security.service";
import { accessStateOf } from "../trial-state";

// Page d'accueil du propriétaire : l'essentiel de toutes les boutiques en un coup d'œil
@Component({
    selector: "app-owner-dashboard",
    imports: [DatePipe, RouterLink, Icon],
    templateUrl: "./owner-dashboard.html",
    styleUrl: "./owner-dashboard.css",
})
export class OwnerDashboard {
    protected auth = inject(AuthService);
    protected support = inject(SupportService);

    private owner = inject(OwnerShopService);
    private security = inject(SecurityService);

    shops = rxResource({ stream: () => this.owner.getShops() });
    overview = rxResource({ stream: () => this.security.getOverview() });

    all = computed(() => (this.shops.hasValue() ? this.shops.value() : []));
    active = computed(() => this.all().filter((s) => s.status === "ACTIVE").length);
    suspended = computed(() => this.all().filter((s) => s.status === "SUSPENDED").length);
    sales = computed(() => this.all().reduce((sum, s) => sum + s.sales_last_30_days, 0));

    // boutiques à regarder : suspendues, essai qui se termine ou accès terminé
    toWatch = computed(() =>
        this.all()
            .map((shop) => ({ shop, state: accessStateOf(shop) }))
            .filter(
                ({ shop, state }) =>
                    shop.status === "SUSPENDED" ||
                    state?.tone === "warn" ||
                    state?.tone === "ended",
            )
            .slice(0, 5),
    );

    latest = computed(() =>
        [...this.all()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    );

    // une phrase sur la sécurité, la même règle que la page Sécurité
    alerts = computed(() => {
        if (!this.overview.hasValue()) return null;
        const { failedLogins24h, lockedAccounts } = this.overview.value();
        return failedLogins24h + lockedAccounts;
    });
}

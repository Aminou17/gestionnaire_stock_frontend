import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { SupportService } from "../../../core/support/support.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { MarginsPanel } from "../margins-panel/margins-panel";
import { OwnerShopService } from "../owner-shop.service";
import { UsagePanel } from "../usage-panel/usage-panel";
import { SecurityService } from "../security/security.service";
import { accessStateOf } from "../trial-state";

// Page d'accueil du propriétaire : l'essentiel de toutes les boutiques en un coup d'œil
@Component({
    selector: "app-owner-dashboard",
    imports: [RouterLink, PageHeader, Icon, FcfaPipe, MarginsPanel, UsagePanel],
    templateUrl: "./owner-dashboard.html",
    styleUrls: ["../owner-kpis.css", "./owner-dashboard.css"],
})
export class OwnerDashboard {
    protected auth = inject(AuthService);
    protected support = inject(SupportService);

    private owner = inject(OwnerShopService);
    private security = inject(SecurityService);

    shops = rxResource({ stream: () => this.owner.getShops() });
    overview = rxResource({ stream: () => this.security.getOverview() });
    marginReport = rxResource({ stream: () => this.owner.getMargins(30) });

    all = computed(() => (this.shops.hasValue() ? this.shops.value() : []));
    active = computed(() => this.all().filter((s) => s.status === "ACTIVE").length);
    trial = computed(
        () =>
            this.all().filter(
                (s) => s.status === "ACTIVE" && accessStateOf(s)?.label.startsWith("Essai :"),
            ).length,
    );
    sales = computed(() => this.all().reduce((sum, s) => sum + s.sales_last_30_days, 0));

    // Boutiques à regarder : suspendues, essai qui se termine ou accès terminé
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

    margin = computed(() =>
        this.marginReport.hasValue()
            ? this.marginReport.value().rows.reduce((sum, row) => sum + row.margin, 0)
            : 0,
    );

    // Une phrase sur la sécurité, la même règle que la page Sécurité
    alerts = computed(() => {
        if (!this.overview.hasValue()) return null;
        const { failedLogins24h, lockedAccounts } = this.overview.value();
        return failedLogins24h + lockedAccounts;
    });
}

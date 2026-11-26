import { Component, computed, inject, input } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { OwnedShop } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { UsageBars } from "../usage-bars/usage-bars";
import { lastDays } from "../usage-days";

const DAYS = 7;

// Activité de chaque boutique : combien de pages ouvertes par jour, et la part des vendeurs
@Component({
    selector: "app-usage-panel",
    imports: [RouterLink, UsageBars],
    templateUrl: "./usage-panel.html",
    styleUrl: "./usage-panel.css",
})
export class UsagePanel {
    private owner = inject(OwnerShopService);

    shops = input.required<OwnedShop[]>();

    protected days = DAYS;

    report = rxResource({ stream: () => this.owner.getUsage(DAYS) });

    rows = computed(() => {
        if (!this.report.hasValue()) return [];
        const usage = this.report.value().rows;

        return this.shops()
            .filter((shop) => shop.status === "ACTIVE" && !shop.deleted_at)
            .map((shop) => {
                const mine = usage.filter((row) => row.shop_id === shop.id);
                const total = mine.reduce((sum, row) => sum + row.views, 0);
                const employees = mine.reduce((sum, row) => sum + (row.employee_views ?? 0), 0);
                return { shop, total, employees, bars: lastDays(mine, DAYS) };
            })
            .sort((a, b) => b.total - a.total || a.shop.name.localeCompare(b.shop.name));
    });

    // Boutiques qui n'ont rien ouvert de la semaine : elles ne s'affichent que dans le compte final
    active = computed(() => this.rows().filter((row) => row.total > 0));
    silent = computed(() => this.rows().length - this.active().length);
}

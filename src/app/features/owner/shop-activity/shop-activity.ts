import { DecimalPipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";

import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { OwnerShopService } from "../owner-shop.service";
import { OPENABLE_PAGES, pageLabel, pageSection } from "../page-labels";
import { UsageBars } from "../usage-bars/usage-bars";
import { lastDays } from "../usage-days";

const PERIODS = [
    { days: 7, label: "7 jours" },
    { days: 14, label: "14 jours" },
    { days: 30, label: "30 jours" },
    { days: 90, label: "90 jours" },
];

// Page de collecte d'infos d'une boutique : ce que son équipe ouvre, jour après jour, et ce qu'elle n'utilise jamais
@Component({
    selector: "app-shop-activity",
    imports: [DecimalPipe, FcfaPipe, Icon, PageHeader, UsageBars],
    templateUrl: "./shop-activity.html",
    styleUrls: ["../owner-kpis.css", "./shop-activity.css"],
})
export class ShopActivity {
    private owner = inject(OwnerShopService);

    protected id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id"));
    protected backLink = `/owner/shops/${this.id}`;
    protected periods = PERIODS;
    protected label = pageLabel;

    days = signal(14);

    shop = rxResource({
        params: () => (this.id > 0 ? this.id : undefined),
        stream: ({ params }) => this.owner.getShop(params),
    });
    usage = rxResource({
        params: () => (this.id > 0 ? this.days() : undefined),
        stream: ({ params }) => this.owner.getShopUsage(this.id, params),
    });
    margins = rxResource({
        params: () => this.days(),
        stream: ({ params }) => this.owner.getMargins(params),
    });

    bars = computed(() =>
        lastDays(this.usage.hasValue() ? this.usage.value().daily : [], this.days()),
    );
    total = computed(() => this.bars().reduce((sum, bar) => sum + bar.views, 0));
    activeDays = computed(() => this.bars().filter((bar) => bar.views > 0).length);
    pages = computed(() => (this.usage.hasValue() ? this.usage.value().pages : []));

    // part des pages ouvertes par les vendeurs, en pourcentage
    employeeShare = computed(() => {
        const total = this.total();
        if (total === 0) return null;
        const employees = this.pages().reduce((sum, page) => sum + (page.employee_views ?? 0), 0);
        return Math.round((employees / total) * 100);
    });

    topPage = computed(() => this.pages()[0] ?? null);
    maxViews = computed(() => Math.max(1, ...this.pages().map((page) => page.views)));

    // pages regroupées par rubrique, de la plus utilisée à la moins utilisée
    sections = computed(() => {
        const totals = new Map<string, number>();
        for (const page of this.pages()) {
            const name = pageSection(page.page);
            totals.set(name, (totals.get(name) ?? 0) + page.views);
        }
        const max = Math.max(1, ...totals.values());
        return [...totals.entries()]
            .map(([name, views]) => ({ name, views, width: (views / max) * 100 }))
            .sort((a, b) => b.views - a.views);
    });

    // pages jamais ouvertes sur la période : de quoi savoir ce qui ne sert pas
    neverOpened = computed(() => {
        const opened = new Set(this.pages().map((page) => page.page));
        return OPENABLE_PAGES.filter((page) => !opened.has(page)).map((page) => pageLabel(page));
    });

    margin = computed(() =>
        this.margins.hasValue()
            ? (this.margins.value().rows.find((row) => row.shop_id === this.id) ?? null)
            : null,
    );

    select(days: number) {
        this.days.set(days);
    }
}

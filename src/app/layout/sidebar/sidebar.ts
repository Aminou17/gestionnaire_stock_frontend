import { Component, ElementRef, computed, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { COMPANY_NAME, PRODUCT_NAME } from "../../core/brand";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../../shared/icon/icon";
import { Avatar } from "../../shared/avatar/avatar";
import { LayoutService } from "../layout.service";
import { SECTIONS } from "../nav-items";

@Component({
    selector: "app-sidebar",
    imports: [RouterLink, RouterLinkActive, Icon, Avatar],
    templateUrl: "./sidebar.html",
    styleUrl: "./sidebar.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "profileOpen.set(false)",
    },
})
export class Sidebar {
    private el = inject(ElementRef);
    protected auth = inject(AuthService);
    protected productName = PRODUCT_NAME;
    protected companyName = COMPANY_NAME;
    protected layout = inject(LayoutService);
    protected theme = inject(ThemeService);
    protected alerts = inject(LowStockAlertService);
    protected shop = inject(ShopSettingsService);

    // menu à plat : le manager ne voit que les pages auxquelles il a accès
    sections = computed(() => {
        const isAdmin = this.auth.isAdmin();
        return SECTIONS.map((section) => ({
            ...section,
            items: section.items
                .flatMap((item) => item.children ?? [item])
                .filter((item) => isAdmin || !item.adminOnly),
        })).filter((section) => section.items.length > 0);
    });

    profileOpen = signal(false);

    close() {
        this.profileOpen.set(false);
        this.layout.sidebarOpen.set(false);
    }

    openSearch() {
        this.close();
        this.layout.searchOpen.set(true);
    }

    onDocumentClick(event: Event) {
        if (!this.el.nativeElement.querySelector(".profile")?.contains(event.target)) {
            this.profileOpen.set(false);
        }
    }
}

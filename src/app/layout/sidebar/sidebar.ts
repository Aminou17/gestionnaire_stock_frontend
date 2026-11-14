import { Component, ElementRef, computed, inject, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { COMPANY_NAME, PRODUCT_NAME } from "../../core/brand";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../../shared/icon/icon";
import { Avatar } from "../../shared/avatar/avatar";
import { LayoutService } from "../layout.service";
import { NavItem, SECTIONS } from "../nav-items";

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
    private router = inject(Router);
    protected auth = inject(AuthService);
    protected productName = PRODUCT_NAME;
    protected companyName = COMPANY_NAME;
    protected layout = inject(LayoutService);
    protected theme = inject(ThemeService);
    protected alerts = inject(LowStockAlertService);
    protected shop = inject(ShopSettingsService);

    // le manager ne voit que les pages auxquelles il a accès
    sections = computed(() => {
        const isAdmin = this.auth.isAdmin();
        const visible = (item: NavItem) => isAdmin || !item.adminOnly;
        return SECTIONS.map((section) => ({
            ...section,
            items: section.items
                .filter(visible)
                .map((item) => {
                    if (!item.children) return item;
                    const children = item.children.filter(visible);
                    // un groupe qui n'a plus qu'une page n'a pas besoin de dossier
                    return children.length === 1 ? children[0] : { ...item, children };
                })
                .filter((item) => !item.children || item.children.length > 0),
        })).filter((section) => section.items.length > 0);
    });

    openGroups = signal<string[]>([]);

    constructor() {
        this.openCurrentGroup(this.router.url);
        this.router.events
            .pipe(filter((event) => event instanceof NavigationEnd))
            .subscribe((event) => this.openCurrentGroup(event.urlAfterRedirects));
    }

    // le groupe de la page affichée s'ouvre tout seul
    private openCurrentGroup(url: string) {
        for (const section of SECTIONS) {
            for (const item of section.items) {
                const inside = item.children?.some((child) => url.startsWith(child.path ?? "?"));
                if (inside && !this.openGroups().includes(item.label)) {
                    this.openGroups.update((list) => [...list, item.label]);
                }
            }
        }
    }

    hasAlerts(item: NavItem) {
        return !!item.children?.some((child) => child.path === "/alerts");
    }

    toggleGroup(label: string) {
        this.openGroups.update((list) =>
            list.includes(label) ? list.filter((name) => name !== label) : [...list, label],
        );
    }

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

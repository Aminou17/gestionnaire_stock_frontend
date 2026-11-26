import { closeOnOutsideClick } from "../../shared/outside-click";
import { Component, DestroyRef, ElementRef, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter, map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { COMPANY_NAME, PRODUCT_NAME } from "../../core/brand";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { SupportService } from "../../core/support/support.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../../shared/icon/icon";
import { Avatar } from "../../shared/avatar/avatar";
import { ModuleAccess } from "../../core/modules/module-access";
import { LayoutService } from "../layout.service";
import { FOOTER_LINKS, NavItem, SECTIONS } from "../nav-items";

@Component({
    selector: "app-sidebar",
    imports: [RouterLink, RouterLinkActive, Icon, Avatar],
    templateUrl: "./sidebar.html",
    styleUrl: "./sidebar.css",
    host: {
        "(document:keydown.escape)": "profileOpen.set(false); panel.set(null)",
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
    protected support = inject(SupportService);
    // Un cadenas marque ce qui ne fait pas partie de la formule de la boutique
    protected access = inject(ModuleAccess);

    constructor() {
        // Une réponse du support apparaît sans recharger la page
        const refresh = () => this.support.refreshUnread("user");
        refresh();

        const timer = setInterval(refresh, 60_000);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }

    // La page affichée est dans ce groupe
    holdsUrl(group: NavItem) {
        const path = this.url().split("?")[0];
        return (group.children ?? []).some(
            (child) => path === child.path || path.startsWith(child.path + "/"),
        );
    }

    // Nom de la page affichée dans ce groupe, montré sous le nom du groupe
    activeChild(group: NavItem) {
        const path = this.url().split("?")[0];
        return (
            (group.children ?? [])
                .filter((child) => !child.queryParams)
                .find((child) =>
                    child.exact
                        ? path === child.path
                        : path === child.path || path.startsWith(child.path + "/"),
                )?.label ?? null
        );
    }

    // Rubrique ouverte en carreaux ; le menu réduit garde ses icônes à plat
    panel = signal<string | null>(null);

    private outsideClick = closeOnOutsideClick(
        () => this.profileOpen(),
        (target) => !!this.el.nativeElement.querySelector(".profile")?.contains(target),
        () => this.profileOpen.set(false),
    );
    panelGroup = computed(() => {
        const label = this.panel();
        if (!label || this.layout.collapsed()) return null;
        return (
            this.sections()
                .flatMap((section) => section.items)
                .find((item) => item.label === label && item.children) ?? null
        );
    });

    // Sur téléphone, le tiroir se range : la fenêtre des carreaux prend toute la place
    openPanel(group: NavItem) {
        this.profileOpen.set(false);
        this.layout.sidebarOpen.set(false);
        this.panel.set(group.label);
    }

    closePanel() {
        this.panel.set(null);
    }

    // Pastille d'alertes sur le groupe quand il est fermé, pour ne pas la perdre
    // le manager ne voit que les pages auxquelles il a accès ; un groupe sans page disparaît
    sections = computed(() => {
        const isAdmin = this.auth.isAdmin();
        const allowed = (item: NavItem) => isAdmin || !item.adminOnly;

        return SECTIONS.map((section) => ({
            ...section,
            items: section.items
                .filter(allowed)
                .map((item) =>
                    item.children ? { ...item, children: item.children.filter(allowed) } : item,
                )
                .filter((item) => !item.children || item.children.length > 0),
        })).filter((section) => section.items.length > 0);
    });

    private router = inject(Router);
    private url = toSignal(
        this.router.events.pipe(
            filter((event) => event instanceof NavigationEnd),
            map(() => this.router.url),
        ),
        { initialValue: this.router.url },
    );

    footerLinks = computed(() =>
        FOOTER_LINKS.filter((link) => this.auth.isAdmin() || !link.adminOnly),
    );

    profileOpen = signal(false);

    // Après un choix, on revient à la liste : le groupe montre la page choisie
    close() {
        this.panel.set(null);
        this.profileOpen.set(false);
        this.layout.sidebarOpen.set(false);
    }

    openSearch() {
        this.close();
        this.layout.searchOpen.set(true);
    }
}

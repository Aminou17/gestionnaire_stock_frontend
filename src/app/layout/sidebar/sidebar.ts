import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter, map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { COMPANY_NAME, PRODUCT_NAME } from "../../core/brand";
import { InstallService } from "../../core/pwa/install.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { SupportService } from "../../core/support/support.service";
import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../../shared/icon/icon";
import { ToastService } from "../../shared/toast/toast.service";
import { Avatar } from "../../shared/avatar/avatar";
import { LayoutService } from "../layout.service";
import { FOOTER_LINKS, NavItem, SECTIONS } from "../nav-items";

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
    protected support = inject(SupportService);
    protected pwa = inject(InstallService);
    private toast = inject(ToastService);

    constructor() {
        // une réponse du support apparaît sans recharger la page
        const refresh = () => this.support.refreshUnread("user");
        refresh();

        const timer = setInterval(refresh, 60_000);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));

        effect(() => {
            const group = this.sections()
                .flatMap((section) => section.items)
                .find((item) => this.holdsUrl(item));

            if (group) {
                untracked(() =>
                    this.openGroups.update((list) =>
                        list.includes(group.label) ? list : [...list, group.label],
                    ),
                );
            }
        });
    }

    // la page affichée est dans ce groupe
    holdsUrl(group: NavItem) {
        const path = this.url().split("?")[0];
        return (group.children ?? []).some(
            (child) => path === child.path || path.startsWith(child.path + "/"),
        );
    }

    isOpen(group: NavItem) {
        return this.openGroups().includes(group.label);
    }

    toggle(group: NavItem) {
        this.openGroups.update((list) =>
            list.includes(group.label)
                ? list.filter((label) => label !== group.label)
                : [...list, group.label],
        );
    }

    // pastille d'alertes sur le groupe quand il est fermé, pour ne pas la perdre
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

    // groupes ouverts : celui de la page affichée s'ouvre seul, le reste se plie à la main
    openGroups = signal<string[]>([]);

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

    // Android et ordinateur : la fenêtre du navigateur ; iPhone : on explique le geste
    protected installApp() {
        this.profileOpen.set(false);
        if (this.pwa.canInstall()) {
            this.pwa.install();
        } else {
            this.toast.show("Touchez Partager, puis « Sur l'écran d'accueil »", 6000);
        }
    }
}

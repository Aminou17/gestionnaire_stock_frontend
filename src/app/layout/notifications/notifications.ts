import { formatDate } from "@angular/common";
import {
    Component,
    ElementRef,
    LOCALE_ID,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";

import { getAuditAuthor } from "../../core/audit/audit-author";
import { SecurityAlertService } from "../../core/audit/security-alert.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Icon } from "../../shared/icon/icon";
import { getActivityLabel } from "../../shared/activity-label";

const MAX_PRODUCTS = 4;

// Cloche de l'administrateur : ce qui demande son attention (stock et sécurité)
@Component({
    selector: "app-notifications",
    imports: [RouterLink, Icon],
    templateUrl: "./notifications.html",
    styleUrl: "./notifications.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "onEscape()",
        "(focusout)": "onFocusOut($event)",
    },
})
export class Notifications {
    private el = inject(ElementRef);
    private locale = inject(LOCALE_ID);
    protected stock = inject(LowStockAlertService);
    protected security = inject(SecurityAlertService);

    private button = viewChild.required<ElementRef<HTMLButtonElement>>("button");

    open = signal(false);

    // deux échecs identiques à la suite deviennent une ligne avec x2
    latest = computed(() => {
        const groups: { key: string; text: string; time: string; count: number }[] = [];
        for (const log of this.security.latest()) {
            const text = `${getActivityLabel(log.action)} · ${getAuditAuthor(log)}`;
            const last = groups.at(-1);
            if (last?.text === text) last.count++;
            else groups.push({ key: String(log.id), text, time: log.created_at, count: 1 });
        }
        return groups;
    });

    total = computed(() => this.stock.count() + this.security.count());

    // les produits les plus urgents d'abord : ruptures, puis stock faible
    products = computed(() =>
        [...this.stock.list()]
            .sort(
                (a, b) => Number(b.status === "OUT_OF_STOCK") - Number(a.status === "OUT_OF_STOCK"),
            )
            .slice(0, MAX_PRODUCTS),
    );

    // rien à afficher tant que l'une des deux sources charge ou échoue : on ne dit pas "tout est à jour" à tort
    allClear = computed(
        () =>
            this.total() === 0 &&
            !this.stock.loading() &&
            !this.stock.failed() &&
            !this.security.loading() &&
            !this.security.failed(),
    );

    // temps relatif discret : "à l'instant", "il y a 5 min", puis l'heure
    ago(time: string) {
        const minutes = Math.floor((Date.now() - new Date(time).getTime()) / 60000);
        if (minutes < 1) return "à l'instant";
        if (minutes < 60) return `il y a ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return hours < 24 ? `il y a ${hours} h` : formatDate(time, "dd/MM HH:mm", this.locale);
    }

    toggle() {
        this.open.update((open) => !open);
        // les échecs ont pu arriver depuis le chargement de la page
        if (this.open()) this.security.reload();
    }

    close() {
        this.open.set(false);
    }

    onEscape() {
        if (!this.open()) return;
        this.open.set(false);
        this.button().nativeElement.focus();
    }

    // le clavier sort du panneau avec Tab : on le ferme
    onFocusOut(event: FocusEvent) {
        const next = event.relatedTarget as Node | null;
        if (next && !this.el.nativeElement.contains(next)) this.open.set(false);
    }

    onDocumentClick(event: Event) {
        if (!this.el.nativeElement.contains(event.target)) this.open.set(false);
    }
}

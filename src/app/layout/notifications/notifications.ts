import { DatePipe } from "@angular/common";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";

import { getAuditAuthor } from "../../core/audit/audit-author";
import { SecurityAlertService } from "../../core/audit/security-alert.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Icon } from "../../shared/icon/icon";
import { getActivityLabel } from "../../shared/activity-label";

// Cloche du propriétaire : ce qui demande son attention (stock et sécurité)
@Component({
    selector: "app-notifications",
    imports: [RouterLink, DatePipe, Icon],
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

import { Component, ElementRef, computed, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { Icon } from "../../shared/icon/icon";
import { LayoutService } from "../layout.service";

@Component({
    selector: "app-page-header",
    imports: [RouterLink, Icon],
    templateUrl: "./page-header.html",
    styleUrl: "./page-header.css",
    host: { "(document:click)": "onDocumentClick($event)" },
})
export class PageHeader {
    private el = inject(ElementRef);
    protected auth = inject(AuthService);
    protected alerts = inject(LowStockAlertService);
    protected layout = inject(LayoutService);

    title = input.required<string>();
    subtitle = input<string>();
    // rubrique du menu affichée au-dessus du titre (ex. "Stock")
    section = input<string>();
    // lien de la flèche retour affichée à côté du titre (ex. "/categories")
    back = input<string>();
    backLabel = input("Retour");

    menuOpen = signal(false);

    initials = computed(() => {
        const name = this.auth.user()?.name ?? "";
        return name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join("");
    });

    onDocumentClick(event: Event) {
        if (!this.el.nativeElement.querySelector(".user")?.contains(event.target)) {
            this.menuOpen.set(false);
        }
    }
}

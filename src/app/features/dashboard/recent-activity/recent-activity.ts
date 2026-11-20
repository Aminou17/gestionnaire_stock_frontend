import { formatDate } from "@angular/common";
import { Component, LOCALE_ID, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { Activity, ActivityType } from "../dashboard.model";

const DISPLAY: Record<ActivityType, { icon: IconName; tone: string }> = {
    SALE: { icon: "arrow-up-right", tone: "success" },
    REFUND: { icon: "undo", tone: "danger" },
    STOCK_ENTRY: { icon: "arrow-down", tone: "primary" },
    INVENTORY_ADJUSTMENT: { icon: "refresh", tone: "warning" },
    CASH_OPENING: { icon: "wallet", tone: "primary" },
};

@Component({
    selector: "app-recent-activity",
    imports: [RouterLink, FcfaPipe, Icon],
    templateUrl: "./recent-activity.html",
    styleUrl: "./recent-activity.css",
})
export class RecentActivity {
    private locale = inject(LOCALE_ID);

    title = input("Activité récente");
    items = input<Activity[]>([]);
    loading = input(false);
    error = input(false);
    retry = output();

    display(item: Activity) {
        return DISPLAY[item.type];
    }

    // "14:32" aujourd'hui, "10 nov., 14:32" les jours précédents
    when(item: Activity) {
        const isToday = new Date(item.occurredAt).toDateString() === new Date().toDateString();
        return formatDate(item.occurredAt, isToday ? "HH:mm" : "d MMMM 'à' HH:mm", this.locale);
    }
}

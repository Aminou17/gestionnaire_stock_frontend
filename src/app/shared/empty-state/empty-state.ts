import { Component, input } from "@angular/core";

import { Icon } from "../icon/icon";
import type { IconName } from "../icon/icons";

@Component({
    selector: "app-empty-state",
    imports: [Icon],
    templateUrl: "./empty-state.html",
    styleUrl: "./empty-state.css",
})
export class EmptyState {
    icon = input.required<IconName>();
    title = input.required<string>();
    text = input<string>();
    tone = input<"neutral" | "danger">("neutral");
}

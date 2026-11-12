import { Component, computed, input } from "@angular/core";

import { ICONS, IconName } from "./icons";

@Component({
    selector: "app-icon",
    template: `
        <svg
            [attr.width]="size()"
            [attr.height]="size()"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            @for (d of paths(); track $index) {
                <path [attr.d]="d" />
            }
        </svg>
    `,
    styles: `
        :host {
            display: inline-flex;
            flex-shrink: 0;
        }
    `,
})
export class Icon {
    name = input.required<IconName>();
    size = input(18);

    paths = computed(() => ICONS[this.name()]);
}

import { DatePipe } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { barHeight } from "../usage-days";

export interface UsageBar {
    day: string;
    date: Date;
    views: number;
}

// Petit histogramme : une barre par jour, la plus haute prend toute la hauteur
@Component({
    selector: "app-usage-bars",
    imports: [DatePipe],
    template: `
        <div class="bars" role="img" [attr.aria-label]="summary()">
            @for (bar of bars(); track bar.day) {
                <span
                    class="bar"
                    [class.today]="$last"
                    [style.height.%]="height(bar.views)"
                    [title]="(bar.date | date: 'EEE d MMM') + ' : ' + bar.views + ' pages'"
                ></span>
            }
        </div>
        @if (labels()) {
            <div class="axis" aria-hidden="true">
                <span>{{ bars()[0]?.date | date: "d MMM" }}</span>
                <span>Aujourd'hui</span>
            </div>
        }
    `,
    styles: `
        :host {
            display: block;
            min-width: 0;
        }

        .bars {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: var(--bars-height, 36px);
        }

        .bar {
            flex: 1;
            min-height: 2px;
            border-radius: 3px 3px 0 0;
            background: color-mix(in srgb, var(--primary) 28%, var(--surface));
        }

        .bar.today {
            background: var(--primary);
        }

        .axis {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            color: var(--text-muted);
            font-size: var(--fs-caption);
        }
    `,
})
export class UsageBars {
    bars = input.required<UsageBar[]>();
    labels = input(false);

    private max = computed(() => Math.max(0, ...this.bars().map((bar) => bar.views)));

    protected height = (views: number) => barHeight(views, this.max());

    protected summary = computed(
        () =>
            `Pages ouvertes par jour : ${this.bars()
                .map((bar) => bar.views)
                .join(", ")}`,
    );
}

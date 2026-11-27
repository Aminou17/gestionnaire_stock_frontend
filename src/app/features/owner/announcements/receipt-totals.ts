import { Component, computed, input } from "@angular/core";

import { OwnerAnnouncement } from "../../../core/announcements/announcement.model";

// Reçu, lu, avec et sans réponse : le nombre de boutiques à chaque étape
@Component({
    selector: "app-receipt-totals",
    template: `
        <dl>
            @for (item of items(); track item.label) {
                <div>
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                </div>
            }
        </dl>
    `,
    styles: `
        dl {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
            gap: 8px;
            margin: 0;
        }

        div {
            display: grid;
            gap: 2px;
            padding: 8px 10px;
            border-radius: 10px;
            background: var(--neutral-soft);
        }

        dt {
            color: var(--text-muted);
            font-size: var(--fs-small);
        }

        dd {
            margin: 0;
            font-size: 18px;
            font-weight: var(--fw-semibold);
        }
    `,
})
export class ReceiptTotals {
    announcement = input.required<OwnerAnnouncement>();

    items = computed(() => {
        const a = this.announcement();

        return [
            { label: "Boutiques", value: a.total },
            { label: "Reçu", value: a.received },
            { label: "Lu", value: a.read },
            { label: "Avec réponse", value: a.replied },
            // Reçu mais resté sans réponse
            { label: "Sans réponse", value: a.received - a.replied },
        ];
    });
}

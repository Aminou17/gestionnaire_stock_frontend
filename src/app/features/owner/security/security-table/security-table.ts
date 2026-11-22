import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";

import { EmptyState } from "../../../../shared/empty-state/empty-state";
import { Icon } from "../../../../shared/icon/icon";
import type { IconName } from "../../../../shared/icon/icons";

export type RowTone = "danger" | "warning" | "success" | "neutral";

// une ligne affichable, quelle que soit la liste d'origine
export interface SecurityRow {
    id: string | number;
    icon: IconName;
    tone: RowTone;
    title: string;
    subtitle: string | null;
    shop: string | null;
    detail: string | null;
    badge: { label: string; tone: RowTone } | null;
    // date ISO ; note : précision courte sous la date (ex. "dans 12 min")
    when: string;
    note?: string | null;
    // donnée d'origine, rendue à la page quand la ligne est touchée
    raw?: unknown;
}

export interface TableHeadings {
    main: string;
    shop: string;
    detail: string;
    when: string;
}

// Tableau sur ordinateur, cartes empilées sur téléphone : les mêmes lignes, deux mises en page
@Component({
    selector: "app-security-table",
    imports: [DatePipe, Icon, EmptyState],
    templateUrl: "./security-table.html",
    styleUrls: ["../security-shared.css", "./security-table.css"],
})
export class SecurityTable {
    rows = input.required<SecurityRow[]>();
    headings = input.required<TableHeadings>();
    loading = input(false);
    error = input<string | null>(null);
    emptyTitle = input("Rien à signaler");
    emptyText = input<string>();

    // lignes cliquables : touchées, elles ouvrent leur détail
    clickable = input(false);

    retry = output<void>();
    picked = output<SecurityRow>();

    skeletons = [1, 2, 3, 4, 5, 6];

    // ligne de détails du téléphone : boutique et détail réunis
    meta(row: SecurityRow) {
        return [row.shop, row.detail].filter(Boolean).join(" · ");
    }
}

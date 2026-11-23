import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { ExportFormat } from "../../core/export-format";
import { Inventory, InventoryStatus } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { downloadFile } from "../../shared/download-file";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { Pagination } from "../../shared/pagination/pagination";
import {
    STATUS_ICONS,
    STATUS_TONES,
    inventoryTitle,
    resultSentence,
    shortDate,
} from "./inventory-look";
import { InventoryStatusBadge } from "./inventory-status";

interface StatusFilter {
    label: string;
    statuses: InventoryStatus[];
}

const PAGE_SIZE = 20;

@Component({
    selector: "app-inventories",
    imports: [
        RouterLink,
        PageHeader,
        Icon,
        EmptyState,
        ExportMenu,
        Pagination,
        LoadError,
        InventoryStatusBadge,
    ],
    templateUrl: "./inventories.html",
    styleUrl: "./inventories.css",
})
export class Inventories {
    private inventoryService = inject(InventoryService);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);

    protected filters: StatusFilter[] = [
        { label: "Tous", statuses: [] },
        { label: "En cours", statuses: ["in_progress"] },
        { label: "À valider", statuses: ["counted"] },
        { label: "Terminés", statuses: ["applied"] },
    ];

    filter = signal(this.filters[0]);
    // ce que la personne tape ; la recherche n'est envoyée qu'une fois la frappe terminée
    query = signal("");
    private typing: ReturnType<typeof setTimeout> | undefined;
    page = signal(1);
    pageSize = signal(PAGE_SIZE);

    inventories = rxResource({
        params: () => ({
            statuses: this.filter().statuses,
            search: this.query(),
            page: this.page(),
        }),
        stream: ({ params }) =>
            this.inventoryService.getInventories({ ...params, limit: PAGE_SIZE }),
    });

    // le comptage ouvert est mis en avant en haut de la page
    current = rxResource({
        stream: () =>
            this.inventoryService.getInventories({
                statuses: ["in_progress"],
                search: "",
                page: 1,
                limit: 1,
            }),
    });

    inProgress = computed<Inventory | null>(
        () => (this.current.hasValue() ? this.current.value().data[0] : null) ?? null,
    );

    // la carte du haut remplace sa ligne dans la liste complète
    showCurrent = computed(() => this.inProgress() !== null && this.isUnfiltered());

    rows = computed(() => {
        const rows = this.inventories.hasValue() ? this.inventories.value().data : [];
        const current = this.showCurrent() ? this.inProgress() : null;
        return current ? rows.filter((row) => row.id !== current.id) : rows;
    });

    total = computed(() =>
        this.inventories.hasValue() ? this.inventories.value().pagination.total : 0,
    );

    // première chargement : pas de liste à garder à l'écran
    firstLoad = computed(() => this.inventories.isLoading() && !this.inventories.hasValue());

    exporting = signal(false);
    exportError = signal(false);

    title = inventoryTitle;
    icon = (inventory: Inventory) => STATUS_ICONS[inventory.status];
    tone = (inventory: Inventory) => STATUS_TONES[inventory.status];

    result = (inventory: Inventory) => resultSentence(inventory, this.auth.isAdmin());

    // qui l'a fait, et la date quand le titre est un nom choisi
    details(inventory: Inventory) {
        return [inventory.name ? shortDate(inventory.startedAt) : null, inventory.createdBy.name]
            .filter(Boolean)
            .join(" · ");
    }

    private isUnfiltered() {
        return this.filter().statuses.length === 0 && this.query() === "";
    }

    selectFilter(filter: StatusFilter) {
        this.filter.set(filter);
        this.page.set(1);
    }

    onSearch(value: string) {
        clearTimeout(this.typing);
        this.typing = setTimeout(() => {
            this.query.set(value.trim());
            this.page.set(1);
        }, 300);
    }

    reload() {
        this.inventories.reload();
        this.current.reload();
    }

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(false);

        this.inventoryService
            .exportList(format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    downloadFile(file, `inventaires.${format}`);
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set(true);
                },
            });
    }
}

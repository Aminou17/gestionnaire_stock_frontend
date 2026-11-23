import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { ExportFormat } from "../../core/export-format";
import {
    ApplyResult,
    Inventory,
    InventoryItem,
    ItemFilter,
} from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { downloadFile } from "../../shared/download-file";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { Pagination } from "../../shared/pagination/pagination";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { ToastService } from "../../shared/toast/toast.service";
import { InventoryApplyDialog } from "./inventory-apply-dialog";
import { InventoryCancelDialog } from "./inventory-cancel-dialog";
import { InventoryLineDialog } from "./inventory-line-dialog";
import { STATUS_TONES, ageText, heroSentence, inventoryTitle, isOld } from "./inventory-look";
import { InventoryStatusBadge } from "./inventory-status";
import { InventoryThumb } from "./inventory-thumb";

interface LineFilter {
    value: ItemFilter;
    label: string;
}

const PAGE_SIZE = 25;

@Component({
    selector: "app-inventory-page",
    imports: [
        NgTemplateOutlet,
        RouterLink,
        PageHeader,
        ActionMenu,
        Icon,
        EmptyState,
        LoadError,
        Pagination,
        PhotoZoom,
        FcfaPipe,
        InventoryStatusBadge,
        InventoryThumb,
        InventoryApplyDialog,
        InventoryCancelDialog,
        InventoryLineDialog,
    ],
    templateUrl: "./inventory-page.html",
    styleUrl: "./inventory-page.css",
})
export class InventoryPage {
    private inventoryService = inject(InventoryService);
    private destroyRef = inject(DestroyRef);
    private toast = inject(ToastService);
    protected auth = inject(AuthService);

    id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    private applyDialog = viewChild(InventoryApplyDialog);
    private cancelDialog = viewChild(InventoryCancelDialog);
    private lineDialog = viewChild(InventoryLineDialog);

    // choisi à l'arrivée selon l'état de l'inventaire : les écarts d'abord quand il y en a
    filter = signal<ItemFilter | null>(null);
    // ce que la personne tape ; la recherche n'est envoyée qu'une fois la frappe terminée
    query = signal("");
    private typing: ReturnType<typeof setTimeout> | undefined;
    page = signal(1);
    pageSize = signal(PAGE_SIZE);

    // les lignes de la page affichée ; l'inventaire du haut vit à part pour ne pas sauter au rechargement
    detail = rxResource({
        params: () => ({
            id: this.id(),
            filter: this.filter() ?? "all",
            search: this.query(),
            page: this.page(),
        }),
        stream: ({ params }) =>
            this.inventoryService.getInventory(params.id, { ...params, limit: PAGE_SIZE }),
    });

    inventory = signal<Inventory | null>(null);
    items = computed(() => (this.detail.hasValue() ? this.detail.value().items : []));
    total = computed(() => (this.detail.hasValue() ? this.detail.value().pagination.total : 0));

    // détail de la correction : un compte rendu juste après l'avoir faite
    report = signal<ApplyResult | null>(null);
    // erreurs séparées : l'export n'a rien à voir avec la correction du stock
    exportError = signal(false);
    exporting = signal(false);
    actionError = signal("");

    zoom = signal<{ src: string; name: string } | null>(null);
    // ligne appliquée dont le détail est ouvert
    expanded = signal<number | null>(null);

    isAdmin = this.auth.isAdmin;

    title = computed(() => (this.inventory() ? inventoryTitle(this.inventory()!) : ""));
    tone = computed(() => (this.inventory() ? STATUS_TONES[this.inventory()!.status] : "primary"));
    sentence = computed(() =>
        this.inventory() ? heroSentence(this.inventory()!, this.isAdmin()) : "",
    );
    // le stock du logiciel reste caché tant que le comptage est ouvert, même pour l'administrateur
    blind = computed(() => this.inventory()?.status === "in_progress");
    showAge = computed(() => !!this.inventory() && isOld(this.inventory()!));
    age = computed(() => (this.inventory() ? ageText(this.inventory()!) : ""));

    // Les écarts n'existent pas tant que le comptage est ouvert, et le gérant ne les voit pas alors
    filters = computed<LineFilter[]>(() => {
        const inventory = this.inventory();
        const list: LineFilter[] = [{ value: "all", label: "Tous" }];

        if (inventory && inventory.status !== "in_progress" && inventory.differenceCount !== null) {
            list.push({ value: "differences", label: "Écarts" });
        }

        return list;
    });

    // le menu « … » de l'en-tête : exports et annulation, réservés à l'administrateur
    menuItems = computed<ActionItem[]>(() => {
        const items: ActionItem[] = [
            { id: "pdf", label: "Exporter en PDF", icon: "download" },
            { id: "csv", label: "Exporter en CSV", icon: "download" },
        ];

        if (this.canCancel()) {
            items.push({
                id: "cancel",
                label: "Annuler l'inventaire",
                icon: "ban",
                danger: true,
                separated: true,
            });
        }
        return items;
    });

    canCancel = computed(() => {
        const status = this.inventory()?.status;
        return this.isAdmin() && (status === "in_progress" || status === "counted");
    });

    canApply = computed(() => this.isAdmin() && this.inventory()?.status === "counted");

    notFound = computed(() => {
        const err = this.detail.error();
        return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400);
    });

    constructor() {
        // l'inventaire du haut garde son dernier état quand les lignes se rechargent
        effect(() => {
            if (!this.detail.hasValue()) return;
            const detail = this.detail.value();

            untracked(() => {
                this.inventory.set(detail);
                if (this.filter() === null) this.filter.set(this.firstFilter(detail));
            });
        });
    }

    // « Seulement les écarts » dès que le comptage est terminé et qu'il y en a
    private firstFilter(inventory: Inventory): ItemFilter {
        const hasGaps = inventory.status !== "in_progress" && !!inventory.differenceCount;
        return hasGaps ? "differences" : "all";
    }

    selectFilter(filter: ItemFilter) {
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

    // comment une ligne réagit au clic : recompter, corriger ou voir le détail
    lineMode(line: InventoryItem) {
        const status = this.inventory()?.status;

        if (status === "in_progress") return "recount";
        if (status === "counted" && this.isAdmin()) return "edit";
        if (status === "applied" && line.adjustment !== null && this.isAdmin()) return "detail";
        return "none";
    }

    toggleDetail(line: InventoryItem) {
        this.expanded.set(this.expanded() === line.id ? null : line.id);
    }

    editLine(line: InventoryItem) {
        this.lineDialog()?.open(line);
    }

    askApply() {
        this.actionError.set("");
        this.applyDialog()?.open();
    }

    onApplied(result: ApplyResult) {
        this.report.set(result);
        this.inventory.set({ ...this.inventory()!, ...result.inventory });
        this.detail.reload();
    }

    onLineSaved(inventory: Inventory) {
        this.inventory.set({ ...this.inventory()!, ...inventory });
        this.detail.reload();
        this.toast.show("Quantité enregistrée");
    }

    onCancelled(inventory: Inventory) {
        this.inventory.set({ ...this.inventory()!, ...inventory });
        this.detail.reload();
        this.toast.show("Inventaire annulé");
    }

    onMenu(action: string) {
        if (action === "cancel") this.cancelDialog()?.open();
        else this.exportFile(action as ExportFormat);
    }

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.exportError.set(false);

        this.inventoryService
            .exportInventory(this.id(), format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    downloadFile(file, `inventaire-${this.id()}.${format}`);
                },
                error: () => {
                    this.exporting.set(false);
                    this.exportError.set(true);
                },
            });
    }

    // un produit ignoré, expliqué en mots simples
    skippedText(reason: string) {
        return `${reason}. Son stock n'a pas été modifié.`;
    }

    limitedText(line: ApplyResult["limitedToZero"][number]) {
        return `Le stock devait baisser de ${-line.wanted}, mais il n'en restait que ${-line.applied}. Il est maintenant à 0.`;
    }
}

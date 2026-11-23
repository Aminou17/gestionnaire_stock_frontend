import { DatePipe, NgTemplateOutlet } from "@angular/common";
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
import { ApplyResult, Inventory, InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { downloadFile } from "../../shared/download-file";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Icon } from "../../shared/icon/icon";
import { LoadError } from "../../shared/load-error/load-error";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { ToastService } from "../../shared/toast/toast.service";
import { InventoryApplyDialog } from "./inventory-apply-dialog";
import { InventoryCancelDialog } from "./inventory-cancel-dialog";
import { InventoryLineDialog } from "./inventory-line-dialog";
import { STATUS_TONES, heroSentence, reasonLabel } from "./inventory-look";
import { InventoryStatusBadge } from "./inventory-status";
import { InventoryThumb } from "./inventory-thumb";

// un inventaire ne contient que les produits choisis : une seule page suffit
const MAX_LINES = 500;

@Component({
    selector: "app-inventory-page",
    imports: [
        DatePipe,
        NgTemplateOutlet,
        RouterLink,
        PageHeader,
        ActionMenu,
        Icon,
        EmptyState,
        LoadError,
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

    // les lignes ; l'inventaire du haut vit à part pour ne pas sauter au rechargement
    detail = rxResource({
        params: () => ({ id: this.id() }),
        stream: ({ params }) =>
            this.inventoryService.getInventory(params.id, {
                filter: "all",
                search: "",
                page: 1,
                limit: MAX_LINES,
            }),
    });

    inventory = signal<Inventory | null>(null);
    items = computed(() => (this.detail.hasValue() ? this.detail.value().items : []));

    // les plus gros écarts d'abord, puis l'ordre alphabétique
    sortedItems = computed(() =>
        [...this.items()].sort(
            (a, b) =>
                Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0) ||
                a.productName.localeCompare(b.productName, "fr"),
        ),
    );

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

    tone = computed(() => (this.inventory() ? STATUS_TONES[this.inventory()!.status] : "primary"));
    sentence = computed(() =>
        this.inventory() ? heroSentence(this.inventory()!, this.isAdmin()) : "",
    );
    // le stock du logiciel reste caché tant que le comptage est ouvert, même pour l'administrateur
    blind = computed(() => this.inventory()?.status === "in_progress");

    // le menu « … » de l'en-tête : les détails pour tous, exports et annulation pour l'administrateur
    menuItems = computed<ActionItem[]>(() => {
        const items: ActionItem[] = [];

        if (this.isAdmin()) {
            items.push(
                { id: "pdf", label: "Exporter en PDF", icon: "download" },
                { id: "csv", label: "Exporter en CSV", icon: "download" },
            );
        }

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
            });
        });
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

    reasonText = reasonLabel;

    // un produit ignoré, expliqué en mots simples
    skippedText(reason: string) {
        return `${reason}. Son stock n'a pas été modifié.`;
    }

    limitedText(line: ApplyResult["limitedToZero"][number]) {
        return `Le stock devait baisser de ${-line.wanted}, mais il n'en restait que ${-line.applied}. Il est maintenant à 0.`;
    }
}

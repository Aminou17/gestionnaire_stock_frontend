import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { ExportFormat } from "../../core/export-format";
import { InventoryItem } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Avatar } from "../../shared/avatar/avatar";
import { ExportMenu } from "../../shared/export-menu/export-menu";
import { Icon } from "../../shared/icon/icon";
import { PhotoZoom } from "../../shared/photo-zoom/photo-zoom";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";
import { productInitials } from "../products/product-look";

@Component({
    selector: "app-inventory-page",
    imports: [
        RouterLink,
        DatePipe,
        NgTemplateOutlet,
        PageHeader,
        Icon,
        Avatar,
        ExportMenu,
        PhotoZoom,
        FcfaPipe,
    ],
    templateUrl: "./inventory-page.html",
    styleUrl: "./inventory-page.css",
})
export class InventoryPage {
    private inventoryService = inject(InventoryService);
    private destroyRef = inject(DestroyRef);

    private id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");

    applying = signal(false);
    applyError = signal("");
    exporting = signal(false);

    inventory = rxResource({
        params: () => this.id(),
        stream: ({ params }) => this.inventoryService.getInventory(params),
    });

    data = computed(() => (this.inventory.hasValue() ? this.inventory.value() : undefined));

    // manquants et excédents comptés en unités, pour le résumé
    missing = computed(() =>
        (this.data()?.items ?? []).reduce((sum, i) => sum + Math.max(-i.difference, 0), 0),
    );

    surplus = computed(() =>
        (this.data()?.items ?? []).reduce((sum, i) => sum + Math.max(i.difference, 0), 0),
    );

    // nombre de produits manquants, en trop et conformes, pour les tuiles et la barre
    shortCount = computed(() => (this.data()?.items ?? []).filter((i) => i.difference < 0).length);
    overCount = computed(() => (this.data()?.items ?? []).filter((i) => i.difference > 0).length);
    conformCount = computed(() => (this.data()?.items ?? []).filter((i) => !i.difference).length);

    // les produits en écart d'abord, les plus coûteux en tête
    sortedItems = computed(() => {
        const cost = (item: InventoryItem) => Math.abs(item.difference * item.purchase_price);
        return [...(this.data()?.items ?? [])].sort(
            (a, b) => Number(!!b.difference) - Number(!!a.difference) || cost(b) - cost(a),
        );
    });

    initials = productInitials;

    // photo agrandie au clic, sans quitter la page
    zoom = signal<{ src: string; name: string } | null>(null);

    // appliquer ne sert à rien quand tous les produits sont conformes
    canApply = computed(() => {
        const inventory = this.data();
        return !!inventory && !inventory.applied_at && inventory.items.some((i) => i.difference);
    });

    // un vieux comptage appliqué tard peut fausser le stock : on prévient
    ageInDays = computed(() => {
        const created = this.data()?.created_at;
        return created ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000) : 0;
    });

    notFound = computed(() => {
        const err = this.inventory.error();
        return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400);
    });

    errorMessage = computed(() =>
        this.notFound()
            ? "Cet inventaire est introuvable."
            : "Impossible de charger cet inventaire.",
    );

    askApply() {
        this.applyError.set("");
        this.confirmDialog().nativeElement.showModal();
    }

    // un clic hors de la fenêtre la ferme
    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === this.confirmDialog().nativeElement && !this.applying()) {
            this.closeConfirm();
        }
    }

    // Échap ne ferme pas la fenêtre pendant l'application des écarts
    onConfirmCancel(event: Event) {
        if (this.applying()) event.preventDefault();
    }

    closeConfirm() {
        this.confirmDialog().nativeElement.close();
    }

    apply() {
        if (this.applying()) return;

        this.applying.set(true);
        this.inventoryService
            .applyInventory(this.id())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.applying.set(false);
                    this.closeConfirm();
                    this.inventory.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.applying.set(false);
                    this.closeConfirm();
                    this.applyError.set(
                        err.error?.message ?? "Les écarts n'ont pas pu être appliqués.",
                    );
                },
            });
    }

    exportFile(format: ExportFormat) {
        this.exporting.set(true);
        this.applyError.set("");

        this.inventoryService
            .exportInventory(this.id(), format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.exporting.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `inventaire-${this.id()}.${format}`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url));
                },
                error: () => {
                    this.exporting.set(false);
                    this.applyError.set("Impossible d'exporter cet inventaire.");
                },
            });
    }

    backState() {
        return { backTo: `/inventories/${this.id()}`, backLabel: "Inventaire" };
    }
}

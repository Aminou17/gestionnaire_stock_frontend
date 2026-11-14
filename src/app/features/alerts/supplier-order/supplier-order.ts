import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, computed, inject, linkedSignal, signal } from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { ExportFormat } from "../../../core/export-format";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { LowStockAlert } from "../../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { SupplierService } from "../../../core/stock/supplier.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { productInitials } from "../../products/product-look";
import { whatsappLink } from "../whatsapp";

interface Line {
    selected: boolean;
    quantity: number;
}

const MAX_QUANTITY = 9999;

@Component({
    selector: "app-supplier-order",
    imports: [RouterLink, PageHeader, Icon],
    templateUrl: "./supplier-order.html",
    styleUrl: "./supplier-order.css",
})
export class SupplierOrder {
    private alertService = inject(LowStockAlertService);
    private supplierService = inject(SupplierService);
    private shopService = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);

    back = getBackLink("/alerts", "Alertes");
    initials = productInitials;

    id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))));

    // une erreur réseau ne veut pas dire que le fournisseur n'existe pas
    notFound = computed(
        () => (this.supplier.error() as HttpErrorResponse | undefined)?.status === 404,
    );

    supplier = rxResource({
        params: () => (Number.isInteger(this.id()) ? this.id() : undefined),
        stream: ({ params }) => this.supplierService.getSupplier(params),
    });

    // le nom de la boutique signe le message
    private shop = rxResource({ stream: () => this.shopService.getSettings() });
    private shopName = computed(() => (this.shop.hasValue() ? this.shop.value().name : ""));

    // mêmes alertes que la liste : une seule requête partagée
    alerts = this.alertService.alerts;
    items = computed<LowStockAlert[]>(() =>
        (this.alerts.hasValue() ? this.alerts.value() : []).filter(
            (alert) => alert.supplier_id === this.id(),
        ),
    );

    // chaque produit part avec la quantité conseillée ; les choix de l'admin survivent à un rechargement
    private lines = linkedSignal<LowStockAlert[], Record<number, Line>>({
        source: this.items,
        computation: (items, previous) =>
            Object.fromEntries(
                items.map((alert) => [
                    alert.id,
                    previous?.value[alert.id] ?? {
                        selected: true,
                        quantity: alert.suggested_quantity,
                    },
                ]),
            ),
    });

    rows = computed(() => this.items().map((alert) => ({ alert, ...this.lines()[alert.id] })));
    chosen = computed(() => this.rows().filter((row) => row.selected && row.quantity > 0));
    units = computed(() => this.chosen().reduce((sum, row) => sum + row.quantity, 0));

    // message modifiable à la main ; changer une quantité le recompose
    private custom = signal<string | null>(null);
    edited = computed(() => this.custom() !== null);

    private composed = computed(() => {
        const supplier = this.supplier.hasValue() ? this.supplier.value() : null;
        const lines = this.chosen().map((row) => `- ${row.alert.name} : ${row.quantity}`);
        return [
            `Bonjour ${supplier?.contact || supplier?.name || ""},`.replace(" ,", ","),
            this.shopName()
                ? `Ici la boutique ${this.shopName()}. Je voudrais commander :`
                : "Je voudrais commander :",
            ...lines,
            "Merci de me confirmer la disponibilité et le délai de livraison.",
        ].join("\n");
    });
    message = computed(() => this.custom() ?? this.composed());

    phone = computed(() => (this.supplier.hasValue() ? this.supplier.value().telephone : null));

    whatsappUrl = computed(() => {
        const phone = this.phone();
        if (!phone || this.chosen().length === 0) return null;
        return `${whatsappLink(phone)}?text=${encodeURIComponent(this.message())}`;
    });

    copied = signal(false);
    orderBusy = signal(false);
    error = signal<string | null>(null);

    toggle(id: number) {
        this.change(id, (line) => ({ ...line, selected: !line.selected }));
    }

    step(id: number, delta: number) {
        this.change(id, (line) => ({
            ...line,
            quantity: Math.min(MAX_QUANTITY, Math.max(1, line.quantity + delta)),
        }));
    }

    setQuantity(id: number, value: string) {
        const quantity = Math.floor(Number(value));
        if (!Number.isFinite(quantity) || quantity < 1) return;
        this.change(id, (line) => ({ ...line, quantity: Math.min(MAX_QUANTITY, quantity) }));
    }

    private change(id: number, update: (line: Line) => Line) {
        this.lines.update((lines) => ({ ...lines, [id]: update(lines[id]) }));
        this.custom.set(null);
    }

    editMessage(text: string) {
        this.custom.set(text);
    }

    resetMessage() {
        this.custom.set(null);
    }

    private copiedTimer: ReturnType<typeof setTimeout> | undefined;
    private stopTimer = this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));

    async copy() {
        try {
            await navigator.clipboard.writeText(this.message());
            this.copied.set(true);
            clearTimeout(this.copiedTimer);
            this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
        } catch {
            this.error.set("Impossible de copier le message.");
        }
    }

    downloadOrder(format: ExportFormat) {
        const id = this.id();
        if (!id || this.orderBusy()) return;

        this.orderBusy.set(true);
        this.error.set(null);

        this.alertService
            .getPurchaseOrder(id, format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (file) => {
                    this.orderBusy.set(false);
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `bon-de-commande-${id}.${format}`;
                    link.click();
                    URL.revokeObjectURL(url);
                },
                error: () => {
                    this.orderBusy.set(false);
                    this.error.set("Impossible de préparer le bon de commande.");
                },
            });
    }
}

import { DatePipe } from "@angular/common";
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
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { StockEntryService } from "../../../core/stock/stock-entry.service";
import { SupplierService } from "../../../core/stock/supplier.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { WhatsappIcon } from "../../../shared/icon/whatsapp-icon";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { formatPhone, toTelLink, toWhatsAppLink } from "../../../shared/phone";
import { SupplierForm } from "../supplier-form/supplier-form";
import { BackState, getBackLink } from "../../../core/back-link";

// nombre de livraisons montrées directement sur la fiche
const PREVIEW_SIZE = 5;

@Component({
    selector: "app-supplier-page",
    imports: [RouterLink, DatePipe, PageHeader, Icon, WhatsappIcon, SupplierForm],
    templateUrl: "./supplier-page.html",
    styleUrl: "./supplier-page.css",
})
export class SupplierPage {
    protected back = getBackLink("/suppliers", "Retour aux fournisseurs");
    private supplierService = inject(SupplierService);
    private entryService = inject(StockEntryService);
    private router = inject(Router);
    private shop = inject(ShopSettingsService);

    // la fiche produit ouverte sait ainsi revenir ici
    backState(): BackState {
        return { backTo: this.router.url, backLabel: "Fournisseur" };
    }
    private destroyRef = inject(DestroyRef);

    private supplierForm = viewChild(SupplierForm);
    private confirmDialog = viewChild<ElementRef<HTMLDialogElement>>("confirmBox");

    protected previewSize = PREVIEW_SIZE;

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // un identifiant qui n'est pas un entier n'est même pas demandé au backend
    validId = computed(() => {
        const id = this.id();
        return id !== undefined && Number.isInteger(id) && id > 0;
    });

    supplier = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.supplierService.getSupplier(params),
    });

    data = computed(() => (this.supplier.hasValue() ? this.supplier.value() : undefined));

    // dernières livraisons du fournisseur, avec les totaux de toutes ses livraisons
    entries = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) =>
            this.entryService.getEntries({
                from: null,
                to: null,
                supplierId: params,
                page: 1,
                limit: PREVIEW_SIZE,
            }),
    });

    deliveries = computed(() => (this.entries.hasValue() ? this.entries.value() : undefined));

    // totaux de toutes les livraisons du fournisseur
    stats = computed(() => {
        const counters = this.deliveries()?.counters;
        if (!counters) return [];

        const plural = (count: number) => (count > 1 ? "s" : "");
        return [
            { value: counters.entries, label: `livraison${plural(counters.entries)}` },
            {
                value: counters.units,
                label: `unité${plural(counters.units)} reçue${plural(counters.units)}`,
            },
            { value: counters.products, label: `produit${plural(counters.products)}` },
        ];
    });

    // le backend répond 404 pour un fournisseur inexistant
    notFound = computed(
        () =>
            !this.validId() ||
            (this.supplier.error() as HttpErrorResponse | undefined)?.status === 404,
    );

    // un fournisseur supprimé ne se modifie plus (le backend refuse)
    canManage = computed(() => !!this.data()?.is_active);

    // absent tant que le backend ne le renvoie pas : on cache alors le bloc
    productCount = computed(() => this.data()?.product_count);

    protected formatPhone = (phone: string) => formatPhone(phone, this.shop.defaultCountryCode());
    protected telLink = (phone: string) => toTelLink(phone, this.shop.defaultCountryCode());
    protected whatsAppLink = (phone: string) =>
        toWhatsAppLink(phone, this.shop.defaultCountryCode());

    restoring = signal(false);
    restoreError = signal<string | null>(null);

    // suppression
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }

    editSupplier(field = "name") {
        const supplier = this.data();
        if (supplier) this.supplierForm()?.openEdit(supplier, field);
    }

    askDelete() {
        this.deleteError.set(null);
        this.confirmDialog()?.nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog()?.nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onConfirmCancel(event: Event) {
        if (this.deleting()) event.preventDefault();
    }

    deleteSupplier() {
        const supplier = this.data();
        if (!supplier || this.deleting()) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.supplierService
            .deleteSupplier(supplier.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleting.set(false);
                    this.closeConfirm();
                    this.router.navigate(["/suppliers"]);
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer le fournisseur.",
                    );
                },
            });
    }

    restoreSupplier() {
        const supplier = this.data();
        if (!supplier || this.restoring()) return;

        this.restoring.set(true);
        this.restoreError.set(null);

        this.supplierService
            .restoreSupplier(supplier.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoring.set(false);
                    this.supplier.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoring.set(false);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer le fournisseur.",
                    );
                },
            });
    }
}

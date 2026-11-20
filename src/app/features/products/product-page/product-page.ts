import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { ProductService } from "../../../core/stock/product.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { resizeAvatar, resizeThumb } from "../../../shared/avatar/avatar-resizer";
import { ActionItem, ActionMenu } from "../../../shared/action-menu/action-menu";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { ProductForm } from "../product-form/product-form";
import { AdjustDialog } from "../../stock-movements/adjust-dialog/adjust-dialog";
import { ProductMovements } from "../product-movements/product-movements";
import { marginPercent, productInitials } from "../product-look";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
    selector: "app-product-page",
    imports: [
        NgTemplateOutlet,
        PageHeader,
        Icon,
        FcfaPipe,
        ProductForm,
        ProductMovements,
        AdjustDialog,
        ActionMenu,
    ],
    templateUrl: "./product-page.html",
    styleUrl: "./product-page.css",
})
export class ProductPage {
    private productService = inject(ProductService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    protected auth = inject(AuthService);

    back = getBackLink("/products", "Produits");

    // le formulaire n'existe que pour l'admin
    private form = viewChild(ProductForm);
    private adjustDialog = viewChild(AdjustDialog);
    private history = viewChild(ProductMovements);
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");
    private viewer = viewChild.required<ElementRef<HTMLDialogElement>>("viewer");

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    product = rxResource({
        // un identifiant illisible dans l'adresse ne lance aucune requête
        params: () => (Number.isInteger(this.id()) ? this.id() : undefined),
        stream: ({ params }) => this.productService.getProduct(params!),
    });

    data = computed(() => (this.product.hasValue() ? this.product.value() : undefined));

    // le backend répond 404 pour un produit inexistant ou supprimé
    notFound = computed(
        () => (this.product.error() as HttpErrorResponse | undefined)?.status === 404,
    );
    errorMessage = computed(() => {
        if (this.notFound()) return "Ce produit est introuvable ou a été supprimé.";
        const err = this.product.error() as HttpErrorResponse | undefined;
        return err?.error?.message ?? "Impossible de charger le produit.";
    });

    // marge en francs et en pourcentage, seulement si le prix d'achat est connu (admin)
    margin = computed(() => {
        const product = this.data();
        const percent = product ? marginPercent(product.sale_price, product.purchase_price) : null;
        if (!product || percent === null) return null;
        return { amount: product.sale_price - (product.purchase_price ?? 0), percent };
    });

    initials = productInitials;

    photoSaving = signal(false);
    photoError = signal<string | null>(null);

    async pickPhoto(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        this.photoError.set(null);
        try {
            const [image, thumb] = await Promise.all([
                resizeAvatar(file, 320, 85000),
                resizeThumb(file),
            ]);
            this.sendPhoto(image, thumb);
        } catch (err) {
            this.photoError.set((err as Error).message);
        }
    }

    removePhoto() {
        this.photoError.set(null);
        this.sendPhoto(null);
    }

    private sendPhoto(image: string | null, thumb: string | null = null) {
        this.photoSaving.set(true);

        this.productService.setImage(this.id()!, image, thumb).subscribe({
            next: () => {
                this.photoSaving.set(false);
                this.product.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.photoSaving.set(false);
                this.photoError.set(err.error?.message ?? "Impossible d'enregistrer la photo.");
            },
        });
    }

    openPhoto() {
        this.viewer().nativeElement.showModal();
    }

    closePhoto() {
        this.viewer().nativeElement.close();
    }

    onViewerClick(event: MouseEvent) {
        if (event.target === this.viewer().nativeElement) {
            this.closePhoto();
        }
    }

    deleting = signal(false);
    deleteError = signal<string | null>(null);

    sell() {
        this.router.navigate(["/sales/new"], { queryParams: { productId: this.id() } });
    }

    // menu « ... » : la photo ne peut être retirée que si elle existe
    menuItems = computed<ActionItem[]>(() => [
        { id: "adjust", label: "Ajuster le stock", icon: "stock-entry" },
        { id: "edit", label: "Modifier", icon: "edit" },
        ...(this.data()?.image
            ? [{ id: "photo", label: "Retirer la photo", icon: "image" } as ActionItem]
            : []),
        { id: "delete", label: "Supprimer", icon: "ban", danger: true },
    ]);

    onPick(id: string) {
        if (id === "adjust") this.adjust();
        else if (id === "edit") this.edit();
        else if (id === "photo") this.removePhoto();
        else if (id === "delete") this.askDelete();
    }

    // message de confirmation après un ajustement du stock
    private toast = inject(ToastService);

    adjust() {
        const product = this.data();
        if (product) this.adjustDialog()?.show(product);
    }

    onAdjusted(message: string) {
        this.toast.show(message);
        this.product.reload();
        this.history()?.reload();
        this.stockAlerts.alerts.reload();
    }

    addStock() {
        this.router.navigate(["/stock-entries/new"], {
            queryParams: { productId: this.id() },
            state: { backTo: this.router.url, backLabel: "Produit" },
        });
    }

    edit() {
        this.form()?.openEdit(this.id()!);
    }

    onSaved() {
        this.product.reload();
        this.stockAlerts.alerts.reload();
    }

    askDelete() {
        this.deleteError.set(null);
        this.confirmDialog().nativeElement.showModal();
    }

    closeConfirm() {
        this.confirmDialog().nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === this.confirmDialog().nativeElement) {
            this.closeConfirm();
        }
    }

    deleteProduct() {
        this.deleting.set(true);
        this.deleteError.set(null);

        this.productService.deleteProduct(this.id()!).subscribe({
            next: () => {
                this.deleting.set(false);
                this.closeConfirm();
                this.stockAlerts.alerts.reload();
                this.router.navigate(["/products"]);
            },
            error: (err: HttpErrorResponse) => {
                this.deleting.set(false);
                this.deleteError.set(err.error?.message ?? "Impossible de supprimer le produit.");
            },
        });
    }
}

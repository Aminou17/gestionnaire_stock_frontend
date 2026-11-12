import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { AuthService } from "../../../core/auth/auth.service";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { ProductService } from "../../../core/stock/product.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { ProductForm } from "../product-form/product-form";
import { ProductMovements } from "../product-movements/product-movements";

@Component({
    selector: "app-product-page",
    imports: [RouterLink, DatePipe, PageHeader, Icon, FcfaPipe, ProductForm, ProductMovements],
    templateUrl: "./product-page.html",
    styleUrl: "./product-page.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "menuOpen.set(false)",
    },
})
export class ProductPage {
    private productService = inject(ProductService);
    private stockAlerts = inject(LowStockAlertService);
    private router = inject(Router);
    protected auth = inject(AuthService);

    back = getBackLink("/products", "Produits");

    // le formulaire n'existe que pour l'admin
    private form = viewChild(ProductForm);
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    product = rxResource({
        params: () => this.id(),
        stream: ({ params }) => this.productService.getProduct(params),
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

    menuOpen = signal(false);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    sell() {
        this.router.navigate(["/sales/new"], { queryParams: { productId: this.id() } });
    }

    onDocumentClick(event: Event) {
        if (!(event.target as HTMLElement).closest(".row-menu")) {
            this.menuOpen.set(false);
        }
    }

    addStock() {
        this.menuOpen.set(false);
        this.router.navigate(["/stock-entries"], { queryParams: { productId: this.id() } });
    }

    edit() {
        this.menuOpen.set(false);
        this.form()?.openEdit(this.id()!);
    }

    onSaved() {
        this.product.reload();
        this.stockAlerts.alerts.reload();
    }

    askDelete() {
        this.menuOpen.set(false);
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

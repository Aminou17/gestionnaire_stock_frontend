import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, inject, output, signal, viewChild } from "@angular/core";

import { ProductService } from "../../../core/stock/product.service";
import { Icon } from "../../../shared/icon/icon";

// le backend refuse au-delà de 90 000 caractères
const MAX_FILE_SIZE = 90000;

const TEMPLATE = "Produit;Catégorie;Fournisseur;Prix d'achat;Prix de vente\r\n";

@Component({
    selector: "app-product-import",
    imports: [Icon],
    templateUrl: "./product-import.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./product-import.css"],
})
export class ProductImport {
    private productService = inject(ProductService);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    imported = output();

    fileName = signal("");
    csv = signal("");
    saving = signal(false);
    error = signal<string | null>(null);
    done = signal<number | null>(null);

    open() {
        this.fileName.set("");
        this.csv.set("");
        this.error.set(null);
        this.done.set(null);
        this.dialog().nativeElement.showModal();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    async pickFile(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        this.error.set(null);

        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            this.csv.set("");
            this.fileName.set("");
            this.error.set("Ce fichier est trop gros, 500 produits au maximum.");
            return;
        }

        try {
            this.csv.set(await file.text());
            this.fileName.set(file.name);
        } catch {
            this.csv.set("");
            this.fileName.set("");
            this.error.set("Impossible de lire ce fichier.");
        }
    }

    downloadTemplate() {
        const url = URL.createObjectURL(
            new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "modele-produits.csv";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url));
    }

    send() {
        if (!this.csv() || this.saving()) return;

        this.saving.set(true);
        this.error.set(null);

        this.productService.importCsv(this.csv()).subscribe({
            next: (result) => {
                this.saving.set(false);
                this.done.set(result.imported);
                this.imported.emit();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible d'importer ce fichier.");
            },
        });
    }
}

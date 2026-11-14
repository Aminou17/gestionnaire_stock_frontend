import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { Observable } from "rxjs";

import { StockMovementService } from "../../../core/stock/stock-movement.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { ExportFormat } from "../../../core/export-format";
import { ExportMenu } from "../../../shared/export-menu/export-menu";
import { Icon } from "../../../shared/icon/icon";
import { PeriodFilter, PeriodRange } from "../../../shared/period-filter/period-filter";
import { ExportService } from "./export.service";

type ExportKind = "products" | "sales" | "movements";

@Component({
    selector: "app-settings-export",
    imports: [RouterLink, PageHeader, Icon, PeriodFilter, ExportMenu],
    templateUrl: "./settings-export.html",
    styleUrls: ["../settings-section.css", "./settings-export.css"],
})
export class SettingsExport {
    private exportService = inject(ExportService);
    private movementService = inject(StockMovementService);
    private destroyRef = inject(DestroyRef);

    range = signal<PeriodRange>({ period: "all", from: null, to: null });

    // un seul téléchargement à la fois
    busy = signal<ExportKind | null>(null);
    error = signal<{ kind: ExportKind; text: string } | null>(null);

    exportProducts(format: ExportFormat) {
        this.run(
            "products",
            this.exportService.productsFile(format),
            `produits.${format}`,
            "Impossible d'exporter les produits.",
        );
    }

    exportSales(format: ExportFormat) {
        const { from, to } = this.range();

        this.run(
            "sales",
            this.exportService.salesFile(from, to, format),
            `ventes.${format}`,
            "Impossible d'exporter les ventes.",
        );
    }

    exportMovements(format: ExportFormat) {
        this.run(
            "movements",
            this.movementService.exportFile(
                { from: null, to: null, type: null, productId: null },
                format,
            ),
            `mouvements-stock.${format}`,
            "Impossible d'exporter les mouvements.",
        );
    }

    private run(kind: ExportKind, request: Observable<Blob>, filename: string, fallback: string) {
        this.busy.set(kind);
        this.error.set(null);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (file) => {
                this.busy.set(null);
                this.download(file, filename);
            },
            error: (err) => {
                this.busy.set(null);
                // avec un fichier attendu, le corps de l'erreur n'est pas lisible : on se base sur le statut
                const tooLarge = err instanceof HttpErrorResponse && err.status === 413;
                this.error.set({
                    kind,
                    text: tooLarge
                        ? "Il y a trop de lignes pour un seul fichier, réduisez la période."
                        : fallback,
                });
            },
        });
    }

    private download(file: Blob, filename: string) {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();

        // Firefox et Safari lisent l'adresse après le clic
        setTimeout(() => URL.revokeObjectURL(url));
    }
}

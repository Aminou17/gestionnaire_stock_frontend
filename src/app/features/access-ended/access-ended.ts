import { DatePipe } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Observable } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { PRODUCT_NAME } from "../../core/brand";
import { mailtoLink } from "../../core/contact";
import { Icon } from "../../shared/icon/icon";
import { ExportService } from "../settings/settings-export/export.service";

@Component({
    selector: "app-access-ended",
    imports: [DatePipe, Icon],
    templateUrl: "./access-ended.html",
    styleUrls: ["../auth/auth-form.css", "./access-ended.css"],
})
export class AccessEnded {
    protected auth = inject(AuthService);
    private router = inject(Router);
    private exports = inject(ExportService);
    private destroyRef = inject(DestroyRef);

    protected productName = PRODUCT_NAME;
    protected access = this.auth.access;
    protected suspended = computed(() => this.access()?.state === "suspended");
    protected wasPaid = computed(() => this.access()?.lastPeriod === "paid");

    protected mail = mailtoLink();

    checking = signal(false);
    notice = signal<string | null>(null);
    downloading = signal<"products" | "sales" | null>(null);

    constructor() {
        // l'état a pu changer depuis la connexion (paiement enregistré entre-temps)
        this.check(false);
    }

    // après un paiement : on relit l'accès et on revient dans la boutique s'il est rouvert
    check(manual = true) {
        this.checking.set(true);
        this.notice.set(null);

        this.auth
            .refreshUser()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.checking.set(false);
                    if (!this.access()?.blocked) {
                        this.router.navigate(["/dashboard"]);
                    } else if (manual) {
                        this.notice.set(
                            "L'accès n'est pas encore rouvert. Si vous venez de payer, réessayez dans quelques minutes.",
                        );
                    }
                },
                error: () => {
                    this.checking.set(false);
                    if (manual) this.notice.set("Impossible de vérifier pour le moment.");
                },
            });
    }

    download(kind: "products" | "sales") {
        const file: Observable<Blob> =
            kind === "products"
                ? this.exports.productsFile("csv")
                : this.exports.salesFile(null, null, "csv");

        this.downloading.set(kind);
        file.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (blob) => {
                this.downloading.set(null);
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = kind === "products" ? "produits.csv" : "ventes.csv";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url));
            },
            error: () => {
                this.downloading.set(null);
                this.notice.set("Le téléchargement a échoué. Réessayez.");
            },
        });
    }
}

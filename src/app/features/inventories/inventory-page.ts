import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { InventoryService } from "../../core/stock/inventory.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { FcfaPipe } from "../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-inventory-page",
    imports: [RouterLink, DatePipe, PageHeader, FcfaPipe],
    templateUrl: "./inventory-page.html",
    styleUrl: "./inventory-page.css",
})
export class InventoryPage {
    private inventoryService = inject(InventoryService);

    private id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get("id")))), {
        requireSync: true,
    });

    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");

    applying = signal(false);
    applyError = signal("");

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

    closeConfirm() {
        this.confirmDialog().nativeElement.close();
    }

    apply() {
        if (this.applying()) return;

        this.applying.set(true);
        this.inventoryService.applyInventory(this.id()).subscribe({
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

    backState() {
        return { backTo: `/inventories/${this.id()}`, backLabel: "Inventaire" };
    }
}

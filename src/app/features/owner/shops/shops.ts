import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { Icon } from "../../../shared/icon/icon";
import { NewShopDialog } from "../new-shop-dialog/new-shop-dialog";
import { OwnedShop, ShopStatus } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";

type View = "all" | ShopStatus;

@Component({
    selector: "app-shops",
    imports: [DatePipe, Icon, NewShopDialog],
    templateUrl: "./shops.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./shops.css"],
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "menuFor.set(null)",
    },
})
export class Shops {
    private owner = inject(OwnerShopService);

    private newShop = viewChild.required(NewShopDialog);
    private confirm = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");

    shops = rxResource({ stream: () => this.owner.getShops() });

    search = signal("");
    view = signal<View>("all");
    menuFor = signal<number | null>(null);

    all = computed(() => (this.shops.hasValue() ? this.shops.value() : []));
    activeCount = computed(() => this.all().filter((s) => s.status === "ACTIVE").length);
    suspendedCount = computed(() => this.all().filter((s) => s.status === "SUSPENDED").length);
    salesLast30Days = computed(() =>
        this.all().reduce((sum, shop) => sum + shop.sales_last_30_days, 0),
    );

    list = computed(() => {
        const term = this.search().trim().toLowerCase();
        return this.all().filter(
            (shop) =>
                (this.view() === "all" || shop.status === this.view()) &&
                (!term ||
                    [shop.name, shop.admin_name, shop.admin_email].some((value) =>
                        value?.toLowerCase().includes(term),
                    )),
        );
    });

    // boutique en cours de suspension, en attente de confirmation
    pending = signal<OwnedShop | null>(null);
    updating = signal<number | null>(null);
    actionError = signal<string | null>(null);

    openNewShop() {
        this.newShop().open();
    }

    toggleMenu(id: number) {
        this.menuFor.set(this.menuFor() === id ? null : id);
    }

    onDocumentClick(event: Event) {
        if (!(event.target as HTMLElement).closest(".row-menu")) {
            this.menuFor.set(null);
        }
    }

    askSuspend(shop: OwnedShop) {
        this.menuFor.set(null);
        this.pending.set(shop);
        this.actionError.set(null);
        this.confirm().nativeElement.showModal();
    }

    closeConfirm() {
        if (this.updating() !== null) return;
        this.confirm().nativeElement.close();
    }

    onConfirmCancel(event: Event) {
        if (this.updating() !== null) event.preventDefault();
    }

    confirmSuspend() {
        const shop = this.pending();
        if (!shop) return;
        this.changeStatus(shop, "SUSPENDED");
    }

    reactivate(shop: OwnedShop) {
        this.actionError.set(null);
        this.changeStatus(shop, "ACTIVE");
    }

    private changeStatus(shop: OwnedShop, status: ShopStatus) {
        this.updating.set(shop.id);

        this.owner.setStatus(shop.id, status).subscribe({
            next: () => {
                this.updating.set(null);
                if (this.confirm().nativeElement.open) this.confirm().nativeElement.close();
                this.shops.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.updating.set(null);
                this.actionError.set(err.error?.message ?? "Impossible de changer le statut.");
            },
        });
    }
}

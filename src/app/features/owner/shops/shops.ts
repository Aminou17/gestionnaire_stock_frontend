import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { ActionItem, ActionMenu } from "../../../shared/action-menu/action-menu";
import { Icon } from "../../../shared/icon/icon";
import { Pagination, clientPaging } from "../../../shared/pagination/pagination";
import { NewShopDialog } from "../new-shop-dialog/new-shop-dialog";
import { OwnedShop, ShopStatus } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { trialStateOf } from "../trial-state";

type View = "all" | ShopStatus;

@Component({
    selector: "app-shops",
    imports: [DatePipe, FormsModule, RouterLink, Icon, ActionMenu, NewShopDialog, Pagination],
    templateUrl: "./shops.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./shops.css"],
})
export class Shops {
    protected shopActions: ActionItem[] = [
        { id: "open", label: "Voir la fiche", icon: "eye" },
        { id: "trial", label: "Modifier l'essai", icon: "clock" },
        { id: "suspend", label: "Suspendre la boutique", icon: "ban", danger: true },
    ];

    private owner = inject(OwnerShopService);
    private router = inject(Router);

    private newShop = viewChild.required(NewShopDialog);
    private confirm = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");
    private trialDialog = viewChild.required<ElementRef<HTMLDialogElement>>("trialDialog");

    shops = rxResource({ stream: () => this.owner.getShops() });

    search = signal("");
    view = signal<View>("all");

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

    paging = clientPaging(
        () => this.list(),
        "shops",
        () => this.search() + this.view(),
    );

    // boutique en cours de suspension, en attente de confirmation
    pending = signal<OwnedShop | null>(null);
    updating = signal<number | null>(null);
    actionError = signal<string | null>(null);

    trialState(shop: OwnedShop) {
        return trialStateOf(shop.trial_ends_at);
    }

    // boutique dont on change l'essai, et la durée saisie (vide : retirer l'essai)
    trialShop = signal<OwnedShop | null>(null);
    trialDays = signal<number | null>(null);
    trialError = signal<string | null>(null);
    savingTrial = signal(false);

    askTrial(shop: OwnedShop) {
        this.trialShop.set(shop);
        this.trialDays.set(null);
        this.trialError.set(null);
        this.trialDialog().nativeElement.showModal();
    }

    closeTrial() {
        if (this.savingTrial()) return;
        this.trialDialog().nativeElement.close();
    }

    onTrialCancel(event: Event) {
        if (this.savingTrial()) event.preventDefault();
    }

    saveTrial() {
        const shop = this.trialShop();
        if (!shop) return;

        const days = this.trialDays();
        if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
            this.trialError.set("Indiquez un nombre de jours entre 1 et 365.");
            return;
        }

        this.savingTrial.set(true);
        this.trialError.set(null);

        this.owner.setTrial(shop.id, days).subscribe({
            next: () => {
                this.savingTrial.set(false);
                this.trialDialog().nativeElement.close();
                this.shops.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.savingTrial.set(false);
                this.trialError.set(err.error?.message ?? "Impossible de changer l'essai.");
            },
        });
    }

    openShop(shop: OwnedShop) {
        this.router.navigate(["/owner/shops", shop.id]);
    }

    openNewShop() {
        this.newShop().open();
    }

    onMenu(shop: OwnedShop, action: string) {
        if (action === "open") this.openShop(shop);
        if (action === "trial") this.askTrial(shop);
        if (action === "suspend") this.askSuspend(shop);
    }

    askSuspend(shop: OwnedShop) {
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

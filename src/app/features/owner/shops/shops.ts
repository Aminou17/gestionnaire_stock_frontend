import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { ActionItem, ActionMenu } from "../../../shared/action-menu/action-menu";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { Pagination, clientPaging } from "../../../shared/pagination/pagination";
import { NewShopDialog } from "../new-shop-dialog/new-shop-dialog";
import { OwnedShop, ShopStatus } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { accessStateOf } from "../trial-state";

type View = "all" | ShopStatus | "deleted";

// une boutique supprimée est effacée pour de bon après ce délai
const KEPT_DAYS = 90;
const DAY = 86_400_000;

@Component({
    selector: "app-shops",
    imports: [FormsModule, RouterLink, PageHeader, Icon, ActionMenu, NewShopDialog, Pagination],
    templateUrl: "./shops.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./shops.css"],
})
export class Shops {
    protected actionsOf(shop: OwnedShop): ActionItem[] {
        return [
            { id: "trial", label: "Modifier l'essai", icon: "clock" },
            shop.status === "ACTIVE"
                ? { id: "suspend", label: "Suspendre", icon: "ban" }
                : { id: "reactivate", label: "Réactiver", icon: "undo" },
            { id: "delete", label: "Supprimer", icon: "trash", danger: true, separated: true },
        ];
    }

    private owner = inject(OwnerShopService);

    private newShop = viewChild.required(NewShopDialog);
    private confirm = viewChild.required<ElementRef<HTMLDialogElement>>("confirm");
    private trialDialog = viewChild.required<ElementRef<HTMLDialogElement>>("trialDialog");
    private deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>("deleteDialog");

    shops = rxResource({ stream: () => this.owner.getShops() });

    search = signal("");
    view = signal<View>("all");

    private every = computed(() => (this.shops.hasValue() ? this.shops.value() : []));
    // les boutiques supprimées ne comptent que dans leur propre liste
    all = computed(() => this.every().filter((s) => !s.deleted_at));
    deletedCount = computed(() => this.every().filter((s) => s.deleted_at).length);
    activeCount = computed(() => this.all().filter((s) => s.status === "ACTIVE").length);
    suspendedCount = computed(() => this.all().filter((s) => s.status === "SUSPENDED").length);

    list = computed(() => {
        const term = this.search().trim().toLowerCase();
        const source =
            this.view() === "deleted" ? this.every().filter((s) => s.deleted_at) : this.all();
        return source.filter(
            (shop) =>
                (this.view() === "all" ||
                    this.view() === "deleted" ||
                    shop.status === this.view()) &&
                (!term ||
                    [
                        shop.name,
                        shop.admin_name,
                        shop.admin_email,
                        shop.phone,
                        shop.city,
                        shop.country,
                    ].some((value) => value?.toLowerCase().includes(term))),
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

    // sous le nom : l'administrateur et la ville, rien de plus
    subtitle(shop: OwnedShop) {
        return [shop.admin_name, shop.city].filter(Boolean).join(" · ") || "Aucun administrateur";
    }

    purgeLabel(shop: OwnedShop) {
        const left = Math.ceil(
            (new Date(shop.deleted_at!).getTime() + KEPT_DAYS * DAY - Date.now()) / DAY,
        );
        return left > 1 ? `Effacée dans ${left} jours` : "Effacée demain";
    }

    trialState(shop: OwnedShop) {
        return accessStateOf(shop);
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

    openNewShop() {
        this.newShop().open();
    }

    onMenu(shop: OwnedShop, action: string) {
        if (action === "trial") this.askTrial(shop);
        if (action === "suspend") this.askSuspend(shop);
        if (action === "reactivate") this.reactivate(shop);
        if (action === "delete") this.askDelete(shop);
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

    // boutique en cours de suppression, en attente de confirmation
    deleting = signal<OwnedShop | null>(null);

    askDelete(shop: OwnedShop) {
        this.deleting.set(shop);
        this.actionError.set(null);
        this.deleteDialog().nativeElement.showModal();
    }

    closeDelete() {
        if (this.updating() !== null) return;
        this.deleteDialog().nativeElement.close();
    }

    onDeleteCancel(event: Event) {
        if (this.updating() !== null) event.preventDefault();
    }

    confirmDelete() {
        const shop = this.deleting();
        if (!shop) return;

        this.updating.set(shop.id);
        this.owner.deleteShop(shop.id).subscribe({
            next: () => {
                this.updating.set(null);
                this.deleteDialog().nativeElement.close();
                this.shops.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.updating.set(null);
                this.actionError.set(err.error?.message ?? "Impossible de supprimer la boutique.");
            },
        });
    }

    restore(shop: OwnedShop) {
        this.actionError.set(null);
        this.updating.set(shop.id);

        this.owner.restoreShop(shop.id).subscribe({
            next: () => {
                this.updating.set(null);
                this.view.set("all");
                this.shops.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.updating.set(null);
                this.actionError.set(err.error?.message ?? "Impossible de restaurer la boutique.");
            },
        });
    }
}

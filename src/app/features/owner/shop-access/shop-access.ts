import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    ElementRef,
    computed,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { ShopModule } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";

const GROUP_ORDER = ["Vente", "Caisse", "Stock", "Gestion"];

// Les accès d'une boutique : le propriétaire coche ce qu'elle peut utiliser (utile pour une formule payante)
@Component({
    selector: "app-shop-access",
    imports: [PageHeader, Icon],
    templateUrl: "./shop-access.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./shop-access.css"],
})
export class ShopAccess {
    private owner = inject(OwnerShopService);

    protected id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id"));
    protected backLink = `/owner/shops/${this.id}`;

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    shop = rxResource({
        params: () => (this.id > 0 ? this.id : undefined),
        stream: ({ params }) => this.owner.getShop(params),
    });
    data = rxResource({
        params: () => (this.id > 0 ? this.id : undefined),
        stream: ({ params }) => this.owner.getShopModules(params),
    });

    private baseline = computed(
        () =>
            new Set(
                (this.data.hasValue() ? this.data.value().modules : [])
                    .filter((module) => !module.enabled)
                    .map((module) => module.key),
            ),
    );

    // accès retirés dans le formulaire ; repart de l'état enregistré à chaque rechargement
    draft = linkedSignal(() => new Set(this.baseline()));

    modules = computed(() => (this.data.hasValue() ? this.data.value().modules : []));
    core = computed(() => (this.data.hasValue() ? this.data.value().core : []));

    groups = computed(() =>
        GROUP_ORDER.map((name) => ({
            name,
            modules: this.modules().filter((module) => module.group === name),
        })).filter((group) => group.modules.length > 0),
    );

    isOn = (module: ShopModule) => !this.draft().has(module.key);

    enabledCount = computed(() => this.modules().length - this.draft().size);

    dirty = computed(() => {
        const draft = this.draft();
        const base = this.baseline();
        return draft.size !== base.size || [...draft].some((key) => !base.has(key));
    });

    // accès qui vont être retirés par cet enregistrement
    removed = computed(() =>
        this.modules().filter(
            (module) => this.draft().has(module.key) && !this.baseline().has(module.key),
        ),
    );

    saving = signal(false);
    notice = signal<{ ok: boolean; text: string } | null>(null);

    toggle(module: ShopModule) {
        this.notice.set(null);
        this.draft.update((current) => {
            const next = new Set(current);
            if (!next.delete(module.key)) next.add(module.key);
            return next;
        });
    }

    // tout cocher, ou ne garder que ce qui est toujours inclus
    setAll(on: boolean) {
        this.notice.set(null);
        this.draft.set(on ? new Set() : new Set(this.modules().map((module) => module.key)));
    }

    cancel() {
        this.notice.set(null);
        this.draft.set(new Set(this.baseline()));
    }

    // retirer un accès demande une confirmation : la boutique le perd tout de suite
    save() {
        if (this.removed().length > 0) this.dialog().nativeElement.showModal();
        else void this.commit();
    }

    closeDialog() {
        this.dialog().nativeElement.close();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.closeDialog();
    }

    async commit() {
        this.saving.set(true);
        try {
            await firstValueFrom(this.owner.setShopModules(this.id, [...this.draft()]));
            this.data.reload();
            this.notice.set({ ok: true, text: "Les accès de la boutique sont enregistrés." });
        } catch (err) {
            this.notice.set({
                ok: false,
                text:
                    (err as HttpErrorResponse).error?.message ??
                    "Les accès n'ont pas pu être enregistrés. Réessayez.",
            });
        } finally {
            this.saving.set(false);
            if (this.dialog().nativeElement.open) this.closeDialog();
        }
    }
}

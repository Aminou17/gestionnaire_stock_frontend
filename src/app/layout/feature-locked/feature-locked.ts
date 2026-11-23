import { Component, ElementRef, effect, inject, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";

import { MODULE_INFO, ModuleStore } from "../../core/modules/module-access";
import { Icon } from "../../shared/icon/icon";

// Message affiché quand on ouvre une fonction qui ne fait pas partie de la formule de la boutique
@Component({
    selector: "app-feature-locked",
    imports: [RouterLink, Icon],
    templateUrl: "./feature-locked.html",
    styleUrls: ["../../shared/dialog/dialog.css", "./feature-locked.css"],
})
export class FeatureLocked {
    private store = inject(ModuleStore);
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    protected feature = () => {
        const key = this.store.locked();
        return key ? MODULE_INFO[key] : null;
    };

    // la page Abonnement existe seulement quand le propriétaire l'a ouverte
    protected subscriptions = this.store.subscriptions;

    constructor() {
        effect(() => {
            const open = this.store.locked() !== null;
            const element = this.dialog().nativeElement;

            if (open && !element.open) element.showModal();
            if (!open && element.open) element.close();
        });
    }

    close() {
        this.store.locked.set(null);
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) this.close();
    }
}

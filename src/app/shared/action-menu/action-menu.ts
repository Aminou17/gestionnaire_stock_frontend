import { NgTemplateOutlet } from "@angular/common";
import {
    Component,
    DestroyRef,
    ElementRef,
    inject,
    input,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";

import { swallowNextOutsideClick } from "../outside-click";
import { Icon } from "../icon/icon";
import { WhatsappIcon } from "../icon/whatsapp-icon";
import { IconName } from "../icon/icons";

export interface ActionItem {
    id: string;
    label: string;
    // "whatsapp" affiche le logo de la marque au lieu d'une icône en traits
    icon: IconName | "whatsapp";
    danger?: boolean;
    disabled?: boolean;
    // Lien interne : l'entrée devient un lien au lieu d'un bouton
    link?: string;
    // Adresse externe : s'ouvre dans un nouvel onglet (WhatsApp, par exemple)
    href?: string;
    // L'entrée est séparée des autres par un trait (action à part, comme rembourser)
    separated?: boolean;
}

// Menu des trois points d'une ligne ou d'une carte. Le panneau est un popover (couche supérieure du
// navigateur) : rien ne peut le recouvrir ni le couper, et un clic dedans ne traverse jamais
// jusqu'à la ligne située derrière. Sur téléphone il monte du bas de l'écran.
@Component({
    selector: "app-action-menu",
    imports: [Icon, RouterLink, WhatsappIcon, NgTemplateOutlet],
    templateUrl: "./action-menu.html",
    styleUrl: "./action-menu.css",
    host: {
        // La ligne parente est cliquable : le menu ne doit pas la déclencher
        "(click)": "$event.stopPropagation()",
    },
})
export class ActionMenu {
    private trigger = viewChild.required<ElementRef<HTMLButtonElement>>("trigger");
    private panel = viewChild.required<ElementRef<HTMLElement>>("panel");

    items = input.required<ActionItem[]>();
    // Nom lu par les lecteurs d'écran, par exemple "Actions pour Adam"
    label = input("Actions");
    // Titre de la feuille sur téléphone
    title = input<string>();
    icon = input<IconName>("more");
    disabled = input(false);

    picked = output<string>();

    open = signal(false);

    private stopSwallowing: () => void = () => {};

    constructor() {
        inject(DestroyRef).onDestroy(() => this.stopSwallowing());
    }

    toggle() {
        const panel = this.panel().nativeElement;

        if (this.open()) {
            this.stopSwallowing();
            panel.hidePopover?.();
            return;
        }

        // Sur ordinateur le CSS aligne le panneau sous le bouton, sur téléphone il se pose en bas
        const rect = this.trigger().nativeElement.getBoundingClientRect();
        panel.style.setProperty("--top", `${rect.bottom + 4}px`);
        panel.style.setProperty("--right", `${window.innerWidth - rect.right}px`);

        panel.showPopover?.();
        this.open.set(true);
        this.stopSwallowing = swallowNextOutsideClick(
            (target) => panel.contains(target) || this.trigger().nativeElement.contains(target),
        );
        panel.querySelector<HTMLElement>(".item:not(:disabled)")?.focus();
    }

    // Le navigateur ferme le popover lui-même (clic à côté, Échap) : on suit son état
    onToggle(event: Event) {
        this.open.set((event as ToggleEvent).newState === "open");
    }

    pick(item: ActionItem) {
        this.stopSwallowing();
        this.panel().nativeElement.hidePopover?.();
        this.open.set(false);
        this.picked.emit(item.id);
    }
}

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

import { swallowNextOutsideClick } from "../outside-click";

import { ExportFormat } from "../../core/export-format";
import { Icon } from "../icon/icon";

// Bouton Exporter : le choix PDF ou CSV s'ouvre dans un popover (couche supérieure du navigateur),
// donc jamais coupé par une barre de puces qui défile. Sur téléphone il se pose en bas de l'écran.
@Component({
    selector: "app-export-menu",
    imports: [Icon],
    templateUrl: "./export-menu.html",
    styleUrl: "./export-menu.css",
})
export class ExportMenu {
    private trigger = viewChild.required<ElementRef<HTMLButtonElement>>("trigger");
    private panel = viewChild.required<ElementRef<HTMLElement>>("panel");

    label = input("Exporter");
    ariaLabel = input<string>();
    // chip : puce de filtre, button : bouton de l'en-tête ou d'un formulaire
    variant = input<"chip" | "button">("button");
    busy = input(false);
    disabled = input(false);

    picked = output<ExportFormat>();

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

        // sur ordinateur le CSS aligne le panneau sous le bouton, sur téléphone il se pose en bas
        const rect = this.trigger().nativeElement.getBoundingClientRect();
        panel.style.setProperty("--top", `${rect.bottom + 4}px`);
        panel.style.setProperty("--right", `${window.innerWidth - rect.right}px`);

        panel.showPopover?.();
        this.open.set(true);
        this.stopSwallowing = swallowNextOutsideClick(
            (target) => panel.contains(target) || this.trigger().nativeElement.contains(target),
        );
        // le clavier arrive directement sur le premier choix
        panel.querySelector<HTMLElement>(".item")?.focus();
    }

    // le navigateur ferme le popover lui-même (clic à côté, Échap) : on suit son état
    onToggle(event: Event) {
        this.open.set((event as ToggleEvent).newState === "open");
    }

    pick(format: ExportFormat) {
        this.stopSwallowing();
        this.panel().nativeElement.hidePopover?.();
        this.open.set(false);
        this.picked.emit(format);
    }
}

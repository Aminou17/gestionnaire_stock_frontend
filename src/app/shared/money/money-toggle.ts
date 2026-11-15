import { DestroyRef, Directive, ElementRef, afterNextRender, inject, signal } from "@angular/core";

// la case qui entoure le montant : un clic n'importe où dedans le masque ou l'affiche
const ZONE = "dl, .stat, app-stat-card, .balance, .summary-main";

// Un montant important de la boutique : un clic sur sa case le remplace par des points, un deuxième clic le remet
@Directive({
    selector: "[appMoney]",
    host: {
        class: "money",
        "[class.money-hidden]": "hidden()",
    },
})
export class MoneyToggle {
    private el = inject<ElementRef<HTMLElement>>(ElementRef);
    private destroyRef = inject(DestroyRef);

    hidden = signal(false);

    constructor() {
        afterNextRender(() => {
            const host = this.el.nativeElement;
            const zone = host.closest<HTMLElement>(ZONE) ?? host.parentElement ?? host;
            zone.classList.add("money-zone");

            // en phase de capture : la case peut être un lien ou une carte cliquable, on ne fait que masquer
            const onClick = (event: Event) => {
                if ((event.target as HTMLElement).closest("button, input, select, textarea"))
                    return;
                event.preventDefault();
                event.stopPropagation();
                this.hidden.update((value) => !value);
            };
            zone.addEventListener("click", onClick, true);
            this.destroyRef.onDestroy(() => zone.removeEventListener("click", onClick, true));
        });
    }
}

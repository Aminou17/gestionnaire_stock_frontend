import { Component, ElementRef, afterNextRender, inject, input, output } from "@angular/core";

import { Icon } from "../icon/icon";

// Photo agrandie en fenêtre modale, fermée par un clic, la croix ou Échap
@Component({
    selector: "app-photo-zoom",
    imports: [Icon],
    templateUrl: "./photo-zoom.html",
    styleUrl: "./photo-zoom.css",
})
export class PhotoZoom {
    private host = inject<ElementRef<HTMLElement>>(ElementRef);

    src = input.required<string>();
    name = input.required<string>();
    closed = output<void>();

    constructor() {
        // showModal garde le focus dans la fenêtre et le rend à la fermeture
        afterNextRender(() => this.host.nativeElement.querySelector("dialog")?.showModal());
    }
}

import { Component, input } from "@angular/core";

// Photo de profil, ou la silhouette par défaut quand la personne n'en a pas.
// La taille vient du CSS de l'endroit où on l'utilise.
@Component({
    selector: "app-avatar",
    template: `<img [src]="photo() || defaultPhoto" alt="" />`,
    styles: `
        :host {
            display: inline-block;
            border-radius: 50%;
            overflow: hidden;
            background: var(--neutral-soft);
        }

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    `,
})
export class Avatar {
    photo = input<string | null | undefined>(null);

    protected defaultPhoto = "/avatar-default.png";
}

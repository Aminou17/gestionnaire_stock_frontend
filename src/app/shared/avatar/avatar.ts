import { Component, computed, input, signal } from "@angular/core";

// Photo de profil, ou la silhouette par défaut quand la personne n'en a pas.
// La taille vient du CSS de l'endroit où on l'utilise.
@Component({
    selector: "app-avatar",
    template: `<img [src]="src()" alt="" (error)="failedPhoto.set(photo())" />`,
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

    // Photo illisible : on retombe sur la silhouette
    protected failedPhoto = signal<string | null | undefined>(undefined);

    protected src = computed(() => {
        const photo = this.photo();
        return photo && photo !== this.failedPhoto() ? photo : "/avatar-default.png";
    });
}

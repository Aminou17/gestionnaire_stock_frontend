import { Component, computed, input, output } from "@angular/core";

import { productInitials } from "../products/product-look";

// Miniature d'un produit : un clic l'agrandit, sans photo ce sont ses initiales
@Component({
    selector: "app-inventory-thumb",
    template: `
        @if (image()) {
            <button
                type="button"
                class="thumb"
                [attr.aria-label]="'Agrandir la photo de ' + name()"
                (click)="zoomed.emit()"
            >
                <img
                    [src]="image()"
                    alt=""
                    width="80"
                    height="80"
                    loading="lazy"
                    decoding="async"
                />
            </button>
        } @else {
            <span class="thumb initials" aria-hidden="true">{{ initials() }}</span>
        }
    `,
    styles: `
        :host {
            display: block;
            flex-shrink: 0;
            width: var(--thumb-size, 44px);
            height: var(--thumb-size, 44px);
        }

        .thumb {
            display: grid;
            place-items: center;
            width: 100%;
            height: 100%;
            padding: 0;
            border: 0;
            border-radius: 12px;
            overflow: hidden;
            background: var(--neutral-soft);
            color: var(--text-muted);
            font-size: var(--fs-small);
            font-weight: var(--fw-semibold);
        }

        button.thumb {
            cursor: zoom-in;
        }

        button.thumb:focus-visible {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
        }

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    `,
})
export class InventoryThumb {
    name = input.required<string>();
    image = input<string | null>(null);
    zoomed = output<void>();

    protected initials = computed(() => productInitials(this.name()));
}

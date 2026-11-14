import { Component, inject } from "@angular/core";

import { Icon } from "../icon/icon";
import { SecretValues } from "./secret-values";

// Petit œil à côté d'une valeur masquée
@Component({
    selector: "app-reveal-toggle",
    imports: [Icon],
    template: `
        <button
            type="button"
            class="eye"
            [attr.aria-label]="
                secret.revealed() ? 'Masquer la valeur du stock' : 'Afficher la valeur du stock'
            "
            (click)="secret.toggle()"
        >
            <app-icon [name]="secret.revealed() ? 'eye-off' : 'eye'" [size]="18" />
        </button>
    `,
    styles: `
        .eye {
            display: inline-grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border: 0;
            border-radius: 50%;
            background: none;
            color: var(--text-muted);
            cursor: pointer;
        }

        .eye:hover {
            background: var(--neutral-soft);
            color: var(--text);
        }
    `,
})
export class RevealToggle {
    protected secret = inject(SecretValues);
}

import { Component, computed, input } from "@angular/core";

import { Icon } from "../../../shared/icon/icon";

// La seule règle à connaître pendant la saisie : la même que celle de l'API
@Component({
    selector: "app-password-hint",
    imports: [Icon],
    template: `
        <small [class.met]="met()" aria-live="polite">
            @if (met()) {
                <app-icon name="check" [size]="12" />
            }
            Au moins 8 caractères
        </small>
    `,
    styles: `
        :host {
            display: block;
            margin-top: 0;
        }

        small {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: var(--text-muted);
            font-size: var(--fs-small);
        }

        small.met {
            color: var(--success);
        }
    `,
})
export class PasswordHint {
    password = input("");
    met = computed(() => this.password().length >= 8);
}

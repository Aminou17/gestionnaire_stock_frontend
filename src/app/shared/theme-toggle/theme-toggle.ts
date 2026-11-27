import { Component, inject } from "@angular/core";

import { ThemeService } from "../../core/theme/theme.service";
import { Icon } from "../icon/icon";

// Bouton rond clair / sombre pour les pages d'accueil et de connexion
@Component({
    selector: "app-theme-toggle",
    imports: [Icon],
    template: `
        <button
            type="button"
            [attr.aria-label]="
                theme.theme() === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'
            "
            (click)="theme.toggle()"
        >
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="18" />
        </button>
    `,
    styles: `
        button {
            display: grid;
            flex: none;
            place-items: center;
            width: 36px;
            height: 36px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            cursor: pointer;
            transition: background 0.15s;
        }

        button:hover {
            background: rgba(255, 255, 255, 0.18);
        }

        button:focus-visible {
            outline: 2px solid #93c5fd;
            outline-offset: 2px;
        }
    `,
})
export class ThemeToggle {
    protected theme = inject(ThemeService);
}

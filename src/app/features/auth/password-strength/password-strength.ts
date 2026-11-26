import { Component, computed, input } from "@angular/core";

import { Icon } from "../../../shared/icon/icon";

const LABELS = ["", "Faible", "Moyen", "Bon", "Excellent"];

// 0 : rien saisi, 1 à 4 : de faible à excellent. Sous 8 caractères, le mot de passe est refusé.
export const passwordLevel = (password: string) => {
    if (!password) return 0;
    if (password.length < 8) return 1;

    const points = [
        password.length >= 12,
        /[a-z]/.test(password) && /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    return 1 + (points >= 1 ? 1 : 0) + (points >= 3 ? 1 : 0) + (points >= 4 ? 1 : 0);
};

@Component({
    selector: "app-password-strength",
    template: `
        <div class="bars" aria-hidden="true">
            @for (step of steps; track step) {
                <span [class.on]="step <= level()"></span>
            }
        </div>
        <span class="text" aria-live="polite">{{ text() }}</span>
        <ul class="criteria">
            @for (item of criteria(); track item.label) {
                <li [class.met]="item.met">
                    <span class="tick" aria-hidden="true"
                        ><app-icon name="check" [size]="10"
                    /></span>
                    {{ item.label }}
                    <span class="visually-hidden">{{ item.met ? "(rempli)" : "(à remplir)" }}</span>
                </li>
            }
        </ul>
    `,
    imports: [Icon],
    styleUrl: "./password-strength.css",
    host: { "[attr.data-level]": "level()" },
})
export class PasswordStrength {
    password = input("");

    steps = [1, 2, 3, 4];
    level = computed(() => passwordLevel(this.password()));

    // Critères affichés sous la jauge, cochés au fil de la saisie
    criteria = computed(() => {
        const password = this.password();

        return [
            { label: "8 caractères", met: password.length >= 8 },
            {
                label: "Maj. et minuscule",
                met: /[a-z]/.test(password) && /[A-Z]/.test(password),
            },
            { label: "Un chiffre", met: /\d/.test(password) },
            { label: "Un symbole", met: /[^A-Za-z0-9]/.test(password) },
        ];
    });

    text = computed(() => {
        const password = this.password();
        if (!password) return "Choisissez-en un solide";
        if (password.length < 8) return "Trop court";

        return LABELS[this.level()];
    });
}

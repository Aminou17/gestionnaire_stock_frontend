import { Component, computed, input } from "@angular/core";

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
    `,
    styleUrl: "./password-strength.css",
    host: { "[attr.data-level]": "level()" },
})
export class PasswordStrength {
    password = input("");

    steps = [1, 2, 3, 4];
    level = computed(() => passwordLevel(this.password()));

    text = computed(() => {
        const password = this.password();
        if (!password) return "8 caractères au moins";
        if (password.length < 8) return "Trop court";

        return LABELS[this.level()];
    });
}

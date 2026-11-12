import { Injectable, effect, signal } from "@angular/core";

type Theme = "light" | "dark";

@Injectable({ providedIn: "root" })
export class ThemeService {
    theme = signal<Theme>(initialTheme());

    constructor() {
        effect(() => {
            const theme = this.theme();
            document.documentElement.dataset["theme"] = theme;
            localStorage.setItem("theme", theme);
        });
    }

    toggle() {
        this.theme.update((t) => (t === "dark" ? "light" : "dark"));
    }
}

// Thème au démarrage : le choix mémorisé, sinon le mode clair
// (on ne suit pas le réglage du système, le sombre doit être activé par l'utilisateur)
function initialTheme(): Theme {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return "dark";
    return "light";
}

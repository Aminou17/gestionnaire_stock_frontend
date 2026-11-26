import { Injectable, effect, signal } from "@angular/core";

type Theme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

@Injectable({ providedIn: "root" })
export class ThemeService {
    theme = signal<Theme>(initialTheme());

    constructor() {
        effect(() => {
            document.documentElement.dataset["theme"] = this.theme();
        });

        // Tant que la personne n'a rien choisi, l'application suit le téléphone (même s'il change en cours de route)
        window.matchMedia?.(DARK_QUERY).addEventListener("change", (event) => {
            if (!savedTheme()) this.theme.set(event.matches ? "dark" : "light");
        });
    }

    // Un choix volontaire est mémorisé et prime sur le réglage du téléphone
    toggle() {
        const next: Theme = this.theme() === "dark" ? "light" : "dark";
        this.theme.set(next);
        localStorage.setItem("theme", next);
    }
}

function savedTheme(): Theme | null {
    const saved = localStorage.getItem("theme");
    return saved === "dark" || saved === "light" ? saved : null;
}

// Thème au démarrage : le choix mémorisé, sinon le réglage du téléphone ou de l'ordinateur
function initialTheme(): Theme {
    const saved = savedTheme();
    if (saved) return saved;

    return window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

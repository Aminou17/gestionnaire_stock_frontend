import { Injectable, effect, signal } from "@angular/core";

// Ouverture du menu sur mobile/tablette (la sidebar devient un tiroir sous 1024px)
@Injectable({ providedIn: "root" })
export class LayoutService {
    sidebarOpen = signal(false);
    searchOpen = signal(false);

    // menu réduit en icônes sur ordinateur, le choix est gardé dans le navigateur
    collapsed = signal(readCollapsed());

    constructor() {
        effect(() => {
            try {
                localStorage.setItem("sidebarCollapsed", String(this.collapsed()));
            } catch {
                // navigateur en navigation privée : on garde le choix pour la session seulement
            }
        });
    }

    toggleCollapsed() {
        this.collapsed.update((value) => !value);
    }
}

function readCollapsed() {
    try {
        return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
        return false;
    }
}

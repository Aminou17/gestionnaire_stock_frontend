import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

const KEY = "welcome-seen";

export const markWelcomeSeen = () => {
    try {
        localStorage.setItem(KEY, "1");
    } catch {
        // stockage bloqué : l'écran reviendra, ce n'est pas grave
    }
};

const alreadySeen = () => {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        return true;
    }
};

// l'écran de bienvenue ne s'affiche qu'une fois, et seulement sur téléphone
export const welcomeGuard: CanActivateFn = () => {
    const isPhone = window.matchMedia("(max-width: 767px)").matches;
    return isPhone && !alreadySeen() ? inject(Router).createUrlTree(["/welcome"]) : true;
};

import { DestroyRef, inject } from "@angular/core";

// Un menu ouvert se ferme au clic à côté, et ce clic ne doit rien ouvrir derrière.
// À appeler dans le constructeur du composant : l'écouteur part avec lui.
export const closeOnOutsideClick = (
    isOpen: () => boolean,
    isInside: (target: Element) => boolean,
    close: () => void,
) => {
    const onClick = (event: Event) => {
        if (!isOpen()) return;
        if (isInside(event.target as Element)) return;

        close();
        event.preventDefault();
        event.stopPropagation();
    };

    document.addEventListener("click", onClick, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener("click", onClick, true));
};

// Pour un popover : le navigateur le ferme avant le clic, on avale donc le prochain clic hors du menu.
// Renvoie la fonction qui annule l'attente (choix fait, Échap, bouton recliqué).
export const swallowNextOutsideClick = (isInside: (target: Element) => boolean) => {
    const stop = () => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
    };
    const onClick = (event: Event) => {
        stop();
        if (isInside(event.target as Element)) return;
        event.preventDefault();
        event.stopPropagation();
    };
    const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") stop();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return stop;
};

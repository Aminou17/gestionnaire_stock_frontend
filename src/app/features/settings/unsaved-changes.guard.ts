import { CanDeactivateFn } from "@angular/router";

// une page de réglages qui peut avoir des modifications non enregistrées
export interface HasUnsavedChanges {
    canLeave(): boolean | Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) => page.canLeave();

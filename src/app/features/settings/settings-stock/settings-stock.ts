import { Component, DestroyRef, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { filter } from "rxjs";

import { StockSettingsService } from "../../../core/stock/stock-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";
import { getBackLink } from "../../../core/back-link";

@Component({
    selector: "app-settings-stock",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-stock.html",
    styleUrls: ["../settings-section.css", "./settings-stock.css"],
})
export class SettingsStock implements HasUnsavedChanges {
    protected back = getBackLink("/settings", "Retour aux paramètres");
    private stockService = inject(StockSettingsService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    settings = rxResource({ stream: () => this.stockService.getSettings() });

    // vide tant qu'aucun seuil n'existe en base, plutôt qu'un 0 inventé
    form = this.fb.group({
        minStock: this.fb.control<number | null>(null, [
            Validators.required,
            Validators.min(0),
            Validators.max(1000000),
            Validators.pattern(/^\d+$/),
        ]),
    });

    saving = signal(false);
    // relit la dernière modification affichée en bas de page après chaque enregistrement
    saveCount = signal(0);
    private leaveDialog = viewChild.required(UnsavedDialog);
    message = signal<{ ok: boolean; text: string } | null>(null);

    constructor() {
        // dirty est faux après un reset : seule une saisie de l'utilisateur efface le message
        this.form.valueChanges
            .pipe(
                filter(() => this.form.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.message.set(null));

        effect(() => {
            if (!this.settings.hasValue()) return;

            // pas encore de ligne en base : le backend renvoie null
            const minStock = this.settings.value()?.min_stock ?? null;
            untracked(() => this.form.reset({ minStock }));
        });
    }

    invalid() {
        const control = this.form.controls.minStock;
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.saving()) return false;

        return !this.form.dirty || this.leaveDialog().ask();
    }

    cancel() {
        this.message.set(null);
        if (this.settings.hasValue()) {
            this.form.reset({ minStock: this.settings.value()?.min_stock ?? null });
        }
    }

    save() {
        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        this.saving.set(true);
        this.message.set(null);

        // une saisie pendant l'envoi serait effacée par la réponse du serveur
        this.form.disable({ emitEvent: false });

        this.stockService
            .updateSettings(Number(this.form.getRawValue().minStock))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.saveCount.update((n) => n + 1);
                    this.settings.set(settings);
                    this.message.set({ ok: true, text: "Enregistré." });
                },
                error: (err) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.message.set({
                        ok: false,
                        text: errorText(err, "Impossible d'enregistrer. Réessayez."),
                    });
                },
            });
    }
}

import { Component, DestroyRef, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule } from "@angular/forms";

import { filter } from "rxjs";

import { CashSettingsService } from "../../../core/cash/cash-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";
import { getBackLink } from "../../../core/back-link";

@Component({
    selector: "app-settings-cash",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-cash.html",
    styleUrls: ["../settings-section.css", "./settings-cash.css"],
})
export class SettingsCash implements HasUnsavedChanges {
    protected back = getBackLink("/settings", "Retour aux paramètres");
    private cashService = inject(CashSettingsService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    settings = rxResource({ stream: () => this.cashService.getSettings() });

    form = this.fb.group({ blindClose: true });

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

            const blindClose = this.settings.value().blind_close;
            untracked(() => this.form.reset({ blindClose }));
        });
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.saving()) return false;

        return !this.form.dirty || this.leaveDialog().ask();
    }

    cancel() {
        this.message.set(null);
        if (this.settings.hasValue()) {
            this.form.reset({ blindClose: this.settings.value().blind_close });
        }
    }

    save() {
        if (!this.settings.hasValue()) return;

        this.saving.set(true);
        this.message.set(null);

        // une saisie pendant l'envoi serait effacée par la réponse du serveur
        this.form.disable({ emitEvent: false });

        this.cashService
            .updateSettings(this.form.getRawValue().blindClose)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.saveCount.update((n) => n + 1);
                    this.settings.set(settings);
                    this.message.set({
                        ok: true,
                        text: settings.blind_close
                            ? "L'employé clôturera sans voir le solde attendu."
                            : "L'employé verra le solde attendu à la clôture.",
                    });
                },
                error: (err) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.message.set({
                        ok: false,
                        text: errorText(err, "Impossible d'enregistrer le réglage."),
                    });
                },
            });
    }
}

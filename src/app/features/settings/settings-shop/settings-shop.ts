import { Component, DestroyRef, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { filter } from "rxjs";

import { Router } from "@angular/router";

import { getBackLink } from "../../../core/back-link";
import { ShopSettings } from "../../../core/shop/shop-settings.model";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";

@Component({
    selector: "app-settings-shop",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-shop.html",
    styleUrls: ["../settings-section.css", "./settings-shop.css"],
})
export class SettingsShop implements HasUnsavedChanges {
    private shopService = inject(ShopSettingsService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);
    private router = inject(Router);

    // on peut arriver ici depuis le ticket de caisse : Retour y ramène
    back = getBackLink("/settings", "Retour aux paramètres");
    backUrl = this.router.serializeUrl(this.back.link);

    settings = rxResource({ stream: () => this.shopService.getSettings() });

    // mêmes tailles que les colonnes de la base
    form = this.fb.group({
        name: ["", [Validators.required, Validators.maxLength(80)]],
        address: ["", Validators.maxLength(200)],
        phone: ["", Validators.maxLength(40)],
        taxId: ["", Validators.maxLength(50)],
        rccm: ["", Validators.maxLength(50)],
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

            const settings = this.settings.value();
            untracked(() => this.fill(settings));
        });
    }

    invalid(name: keyof typeof this.form.controls) {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.saving()) return false;

        return !this.form.dirty || this.leaveDialog().ask();
    }

    cancel() {
        this.message.set(null);
        if (this.settings.hasValue()) this.fill(this.settings.value());
    }

    save() {
        this.form.markAllAsTouched();
        if (this.form.invalid || !this.settings.hasValue()) return;

        this.saving.set(true);
        this.message.set(null);

        // une saisie pendant l'envoi serait effacée par la réponse du serveur
        this.form.disable({ emitEvent: false });

        // le backend remplace toute la fiche : on renvoie le message du ticket lu au chargement
        // (un seul propriétaire modifie ces réglages, le risque de conflit est accepté)
        const input = {
            ...this.form.getRawValue(),
            receiptFooter: this.settings.value().receipt_footer ?? "",
        };

        this.shopService
            .updateSettings(input)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.saveCount.update((n) => n + 1);
                    this.settings.set(settings);
                    this.message.set({ ok: true, text: "Informations enregistrées." });
                },
                error: (err) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.message.set({
                        ok: false,
                        text: errorText(err, "Impossible d'enregistrer les informations."),
                    });
                },
            });
    }

    private fill(settings: ShopSettings) {
        this.form.reset({
            name: settings.name,
            address: settings.address ?? "",
            phone: settings.phone ?? "",
            taxId: settings.tax_id ?? "",
            rccm: settings.rccm ?? "",
        });
    }
}

import {
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { filter } from "rxjs";

import { getBackLink } from "../../../core/back-link";
import { SalesSettings } from "../../../core/sales/sales-settings.model";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";

@Component({
    selector: "app-settings-sales",
    imports: [ReactiveFormsModule, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-sales.html",
    styleUrls: ["../settings-section.css", "./settings-sales.css"],
})
export class SettingsSales implements HasUnsavedChanges {
    private salesService = inject(SalesSettingsService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);
    private router = inject(Router);

    // on peut arriver ici depuis le ticket de caisse : Retour y ramène
    back = getBackLink("/settings", "Retour aux paramètres");
    backUrl = this.router.serializeUrl(this.back.link);

    private leaveDialog = viewChild.required(UnsavedDialog);

    settings = rxResource({ stream: () => this.salesService.getSettings() });

    // mêmes règles que le backend : 10 lettres ou chiffres, remise entière positive ou nulle
    form = this.fb.group({
        ticketPrefix: ["", Validators.pattern(/^[A-Za-z0-9]{0,10}$/)],
        defaultMaxDiscount: this.fb.control<number | null>(null, [
            Validators.min(0),
            Validators.max(10000000),
            Validators.pattern(/^\d+$/),
        ]),
    });

    // l'exemple de numéro suit la saisie
    private prefix = toSignal(this.form.controls.ticketPrefix.valueChanges, { initialValue: "" });
    example = computed(() => formatTicketNumber(12, this.prefix().trim()));

    saving = signal(false);
    message = signal<{ ok: boolean; text: string } | null>(null);

    // relit la dernière modification affichée en bas de page après chaque enregistrement
    saveCount = signal(0);

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
        if (this.form.invalid) return;

        this.saving.set(true);
        this.message.set(null);

        // une saisie pendant l'envoi serait effacée par la réponse du serveur
        this.form.disable({ emitEvent: false });

        const { ticketPrefix, defaultMaxDiscount } = this.form.getRawValue();

        this.salesService
            .updateSettings({ ticketPrefix: ticketPrefix.trim(), defaultMaxDiscount })
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

    private fill(settings: SalesSettings) {
        this.form.reset({
            ticketPrefix: settings.ticket_prefix,
            defaultMaxDiscount: settings.default_max_discount,
        });
    }
}

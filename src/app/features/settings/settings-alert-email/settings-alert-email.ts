import { DatePipe } from "@angular/common";
import { Component, DestroyRef, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { filter } from "rxjs";

import { AlertEmailSettings } from "../../../core/stock/alert-email.model";
import { AlertEmailService } from "../../../core/stock/alert-email.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";
import { getBackLink } from "../../../core/back-link";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
    selector: "app-settings-alert-email",
    imports: [ReactiveFormsModule, DatePipe, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-alert-email.html",
    styleUrls: ["../settings-section.css", "./settings-alert-email.css"],
})
export class SettingsAlertEmail implements HasUnsavedChanges {
    protected back = getBackLink("/settings", "Retour aux paramètres");
    private service = inject(AlertEmailService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    settings = rxResource({ stream: () => this.service.getSettings() });

    hours = Array.from({ length: 24 }, (_, hour) => hour);

    form = this.fb.group({
        enabled: this.fb.control(false),
        recipient: this.fb.control("", [Validators.pattern(EMAIL)]),
        sendHour: this.fb.control(8),
        onlyIfAlerts: this.fb.control(true),
        gmailUser: this.fb.control("", [Validators.pattern(EMAIL)]),
        gmailPassword: this.fb.control(""),
    });

    saving = signal(false);
    testing = signal(false);
    saveCount = signal(0);
    message = signal<{ ok: boolean; text: string } | null>(null);
    private leaveDialog = viewChild.required(UnsavedDialog);

    constructor() {
        this.form.valueChanges
            .pipe(
                filter(() => this.form.dirty),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.message.set(null));

        effect(() => {
            if (!this.settings.hasValue()) return;

            const settings = this.settings.value();
            // un rechargement ne doit pas effacer une saisie en cours
            untracked(() => {
                if (!this.form.dirty) this.fill(settings);
            });
        });
    }

    private fill(settings: AlertEmailSettings) {
        this.form.reset({
            enabled: settings.enabled,
            recipient: settings.recipient ?? "",
            sendHour: settings.sendHour,
            onlyIfAlerts: settings.onlyIfAlerts,
            gmailUser: settings.gmailUser ?? "",
            gmailPassword: "",
        });
    }

    invalid(name: "recipient" | "gmailUser") {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    hasPassword() {
        return this.settings.hasValue() && this.settings.value().hasPassword;
    }

    canLeave() {
        if (this.saving() || this.testing()) return false;

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
        this.form.disable({ emitEvent: false });

        this.service
            .updateSettings(this.form.getRawValue())
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

    // le test utilise les réglages enregistrés, pas ceux en cours de saisie
    sendTest() {
        this.testing.set(true);
        this.message.set(null);

        this.service
            .sendTest()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.testing.set(false);
                    this.message.set({ ok: true, text: "Email de test envoyé." });
                    this.settings.reload();
                },
                error: (err) => {
                    this.testing.set(false);
                    this.message.set({
                        ok: false,
                        text: errorText(err, "Impossible d'envoyer l'email de test."),
                    });
                    this.settings.reload();
                },
            });
    }
}

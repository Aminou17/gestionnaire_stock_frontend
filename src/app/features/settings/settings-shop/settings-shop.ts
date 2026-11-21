import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { filter, map, startWith } from "rxjs";

import { Router } from "@angular/router";

import { getBackLink } from "../../../core/back-link";
import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { ShopSettings } from "../../../core/shop/shop-settings.model";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { COUNTRY_NAMES, countryName } from "../../../shared/country-codes";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { LogoResizerService } from "../logo-resizer.service";
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
    private logoResizer = inject(LogoResizerService);
    private salesSettingsService = inject(SalesSettingsService);

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
        defaultCountryCode: ["", [Validators.required, Validators.pattern(/^[1-9][0-9]{0,3}$/)]],
        receiptFooter: ["", Validators.maxLength(300)],
    });

    // le préfixe se règle dans la page Ventes : sans lui, l'aperçu montre le numéro simple
    private salesSettings = rxResource({ stream: () => this.salesSettingsService.getSettings() });
    ticketNumber = computed(() =>
        formatTicketNumber(
            12,
            this.salesSettings.hasValue() ? this.salesSettings.value().ticket_prefix : "",
        ),
    );

    // l'aperçu du ticket et l'en-tête suivent la saisie
    values = toSignal(
        this.form.valueChanges.pipe(
            startWith(null),
            map(() => this.form.getRawValue()),
        ),
        { initialValue: this.form.getRawValue() },
    );

    logo = computed(() => (this.settings.hasValue() ? this.settings.value().logo : null));

    // deux initiales du nom, affichées tant qu'il n'y a pas de logo
    initials = computed(() => {
        const words = this.values().name.trim().split(/\s+/).filter(Boolean);
        return words
            .slice(0, 2)
            .map((word) => word[0].toUpperCase())
            .join("");
    });

    // le logo s'enregistre tout de suite, séparément des champs
    logoBusy = signal(false);
    logoMessage = signal<{ ok: boolean; text: string } | null>(null);
    private fileInput = viewChild.required<ElementRef<HTMLInputElement>>("fileInput");

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

            // un changement de logo recharge la fiche : la saisie en cours doit survivre
            untracked(() => {
                if (this.form.pristine) this.fill(settings);
            });
        });
    }

    countryName() {
        return countryName(this.form.controls.defaultCountryCode.value);
    }

    // le téléphone de la boutique commence par un autre indicatif (+226) : on propose de le prendre
    suggestedCode = computed(() => {
        const { phone, defaultCountryCode } = this.values();
        const digits = /^\s*(\+|00)/.test(phone)
            ? phone.replace(/^\s*(\+|00)/, "").replace(/\D/g, "")
            : "";
        for (let length = 4; length >= 1; length--) {
            const code = digits.slice(0, length);
            if (code.length === length && COUNTRY_NAMES[code]) {
                return code === defaultCountryCode ? null : code;
            }
        }
        return null;
    });

    useSuggestedCode(code: string) {
        this.form.controls.defaultCountryCode.setValue(code);
        this.form.controls.defaultCountryCode.markAsDirty();
    }

    // chiffres seulement : le + est déjà affiché devant le champ
    onCountryCodeInput(input: HTMLInputElement) {
        const digits = input.value.replace(/\D/g, "").replace(/^0+/, "");
        if (digits !== input.value) {
            input.value = digits;
            this.form.controls.defaultCountryCode.setValue(digits);
        }
    }

    invalid(name: keyof typeof this.form.controls) {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    canLeave() {
        // quitter pendant l'envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.saving() || this.logoBusy()) return false;

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

        this.shopService
            .updateSettings(this.form.getRawValue())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.saveCount.update((n) => n + 1);
                    this.settings.set(settings);
                    this.fill(settings);
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

    pickLogo() {
        this.fileInput().nativeElement.click();
    }

    async onLogoChosen(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        // le même fichier doit pouvoir être choisi une seconde fois
        input.value = "";
        if (!file) return;

        this.logoBusy.set(true);
        this.logoMessage.set(null);

        try {
            const logo = await this.logoResizer.resize(file);
            this.shopService
                .updateLogo(logo)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (settings) => this.onLogoSaved(settings, "Logo enregistré."),
                    error: (err) =>
                        this.onLogoFailed(
                            errorText(err, "Impossible d'enregistrer le logo. Réessayez."),
                        ),
                });
        } catch (err) {
            this.onLogoFailed((err as Error).message);
        }
    }

    removeLogo() {
        this.logoBusy.set(true);
        this.logoMessage.set(null);

        this.shopService
            .removeLogo()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => this.onLogoSaved(settings, "Logo supprimé."),
                error: (err) =>
                    this.onLogoFailed(errorText(err, "Impossible de supprimer le logo.")),
            });
    }

    private onLogoSaved(settings: ShopSettings, text: string) {
        this.logoBusy.set(false);
        this.settings.set(settings);
        this.saveCount.update((n) => n + 1);
        this.logoMessage.set({ ok: true, text });
    }

    private onLogoFailed(text: string) {
        this.logoBusy.set(false);
        this.logoMessage.set({ ok: false, text });
    }

    private fill(settings: ShopSettings) {
        this.form.reset({
            name: settings.name,
            address: settings.address ?? "",
            phone: settings.phone ?? "",
            taxId: settings.tax_id ?? "",
            rccm: settings.rccm ?? "",
            defaultCountryCode: settings.default_country_code ?? "242",
            receiptFooter: settings.receipt_footer ?? "",
        });
    }
}

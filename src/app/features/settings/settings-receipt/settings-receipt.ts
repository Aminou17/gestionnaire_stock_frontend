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
import { RouterLink } from "@angular/router";
import { filter } from "rxjs";

import { SalesSettingsService } from "../../../core/sales/sales-settings.service";
import { formatTicketNumber } from "../../../core/sales/ticket-number";
import { ShopSettings } from "../../../core/shop/shop-settings.model";
import { ShopSettingsService } from "../../../core/shop/shop-settings.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { errorText } from "../error-text";
import { LogoResizerService } from "../logo-resizer.service";
import { SettingsHistory } from "../settings-history/settings-history";
import { HasUnsavedChanges } from "../unsaved-changes.guard";
import { UnsavedDialog } from "../unsaved-dialog/unsaved-dialog";

@Component({
    selector: "app-settings-receipt",
    imports: [ReactiveFormsModule, RouterLink, PageHeader, Icon, UnsavedDialog, SettingsHistory],
    templateUrl: "./settings-receipt.html",
    styleUrls: ["../settings-section.css", "./settings-receipt.css"],
})
export class SettingsReceipt implements HasUnsavedChanges {
    private shopService = inject(ShopSettingsService);
    private salesSettingsService = inject(SalesSettingsService);
    private logoResizer = inject(LogoResizerService);
    private destroyRef = inject(DestroyRef);
    private fb = inject(NonNullableFormBuilder);

    private leaveDialog = viewChild.required(UnsavedDialog);
    private fileInput = viewChild.required<ElementRef<HTMLInputElement>>("fileInput");

    settings = rxResource({ stream: () => this.shopService.getSettings() });

    shop = computed(() => (this.settings.hasValue() ? this.settings.value() : undefined));

    // le préfixe se règle dans la page Ventes : sans lui, l'aperçu montre le numéro simple
    private salesSettings = rxResource({ stream: () => this.salesSettingsService.getSettings() });
    ticketNumber = computed(() =>
        formatTicketNumber(
            12,
            this.salesSettings.hasValue() ? this.salesSettings.value().ticket_prefix : "",
        ),
    );

    form = this.fb.group({
        receiptFooter: ["", Validators.maxLength(300)],
    });

    // l'aperçu du ticket suit la saisie
    footer = toSignal(this.form.controls.receiptFooter.valueChanges, { initialValue: "" });

    saving = signal(false);
    message = signal<{ ok: boolean; text: string } | null>(null);

    // le logo s'enregistre tout de suite, séparément du message
    logoBusy = signal(false);
    logoMessage = signal<{ ok: boolean; text: string } | null>(null);

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

        // un changement de logo recharge la fiche : le message en cours de saisie doit survivre
        effect(() => {
            const shop = this.shop();
            if (!shop) return;

            untracked(() => {
                if (this.form.pristine) this.fillFooter(shop);
            });
        });
    }

    canLeave() {
        // quitter pendant un envoi annulerait la requête sans que l'on sache si elle a abouti
        if (this.saving() || this.logoBusy()) return false;

        return !this.form.dirty || this.leaveDialog().ask();
    }

    cancel() {
        this.message.set(null);

        const shop = this.shop();
        if (shop) this.fillFooter(shop);
    }

    save() {
        const shop = this.shop();
        if (this.form.invalid || !shop) return;

        this.saving.set(true);
        this.message.set(null);

        // une saisie pendant l'envoi serait effacée par la réponse du serveur
        this.form.disable({ emitEvent: false });

        // le backend remplace toute la fiche : on renvoie les coordonnées lues au chargement
        // (un seul propriétaire modifie ces réglages, le risque de conflit est accepté)
        const input = {
            name: shop.name,
            address: shop.address ?? "",
            phone: shop.phone ?? "",
            taxId: shop.tax_id ?? "",
            rccm: shop.rccm ?? "",
            receiptFooter: this.form.getRawValue().receiptFooter,
        };

        this.shopService
            .updateSettings(input)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.settings.set(settings);
                    this.fillFooter(settings);
                    this.saveCount.update((n) => n + 1);
                    this.message.set({ ok: true, text: "Message du ticket enregistré." });
                },
                error: (err) => {
                    this.saving.set(false);
                    this.form.enable({ emitEvent: false });
                    this.message.set({
                        ok: false,
                        text: errorText(err, "Impossible d'enregistrer le message du ticket."),
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
                        this.onLogoFailed(errorText(err, "Impossible d'enregistrer le logo.")),
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

    private fillFooter(shop: ShopSettings) {
        this.form.reset({ receiptFooter: shop.receipt_footer ?? "" });
    }
}

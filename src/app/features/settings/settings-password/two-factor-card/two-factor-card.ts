import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { AuthService, TwoFactorSetup } from "../../../../core/auth/auth.service";
import { copyText } from "../../../../shared/copy-text";
import { Icon } from "../../../../shared/icon/icon";
import { errorText } from "../../error-text";

// off : désactivée, setup : clé à ajouter dans l'application, codes : codes de secours à noter, on : activée
type Step = "off" | "setup" | "codes" | "on";

@Component({
    selector: "app-two-factor-card",
    imports: [ReactiveFormsModule, Icon],
    templateUrl: "./two-factor-card.html",
    styleUrls: ["../../settings-section.css", "./two-factor-card.css"],
})
export class TwoFactorCard {
    private auth = inject(AuthService);
    private fb = inject(NonNullableFormBuilder);
    private destroyRef = inject(DestroyRef);
    private copiedTimer: ReturnType<typeof setTimeout> | undefined;

    step = signal<Step>(this.auth.user()?.twoFactorEnabled ? "on" : "off");
    setup = signal<TwoFactorSetup | null>(null);
    backupCodes = signal<string[]>([]);
    disabling = signal(false);

    busy = signal(false);
    error = signal<string | null>(null);
    copied = signal<"key" | "codes" | null>(null);

    codeControl = this.fb.control("", [Validators.required, Validators.pattern(/^\d{6}$/)]);
    disableForm = this.fb.group({
        password: ["", Validators.required],
        code: ["", Validators.required],
    });

    constructor() {
        // l'état vient du serveur : il peut avoir changé depuis la connexion
        // si la mise à jour échoue, on garde l'état connu depuis la connexion (rien à afficher de plus)
        this.auth
            .refreshUser()
            .pipe(takeUntilDestroyed())
            .subscribe({
                next: () => {
                    if (this.step() === "off" || this.step() === "on") {
                        this.step.set(this.auth.user()?.twoFactorEnabled ? "on" : "off");
                    }
                },
                error: () => {},
            });

        this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
    }

    // clé en groupes de 4 lettres, plus facile à recopier
    get spacedKey() {
        return (
            this.setup()
                ?.secret.match(/.{1,4}/g)
                ?.join(" ") ?? ""
        );
    }

    start() {
        this.busy.set(true);
        this.error.set(null);

        this.auth
            .setupTwoFactor()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (setup) => {
                    this.busy.set(false);
                    this.setup.set(setup);
                    this.codeControl.reset("");
                    this.step.set("setup");
                },
                error: (err) => this.fail(err, "Impossible de générer la clé. Réessayez."),
            });
    }

    cancelSetup() {
        this.setup.set(null);
        this.error.set(null);
        this.step.set("off");
    }

    enable() {
        if (this.codeControl.invalid) {
            this.codeControl.markAsTouched();
            return;
        }

        this.busy.set(true);
        this.error.set(null);

        this.auth
            .enableTwoFactor(this.codeControl.value)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (res) => {
                    this.busy.set(false);
                    this.backupCodes.set(res.backupCodes);
                    this.setup.set(null);
                    this.auth.setTwoFactorEnabled(true);
                    this.step.set("codes");
                },
                error: (err) => this.fail(err, "Impossible d'activer. Réessayez."),
            });
    }

    // un code de 6 chiffres complet part tout seul
    onCodeInput() {
        if (this.codeControl.valid && !this.busy()) this.enable();
    }

    finishCodes() {
        this.backupCodes.set([]);
        this.step.set("on");
    }

    askDisable() {
        this.disableForm.reset();
        this.error.set(null);
        this.disabling.set(true);
    }

    cancelDisable() {
        this.disabling.set(false);
        this.error.set(null);
    }

    disable() {
        if (this.disableForm.invalid) {
            this.disableForm.markAllAsTouched();
            return;
        }

        const { password, code } = this.disableForm.getRawValue();
        this.busy.set(true);
        this.error.set(null);

        this.auth
            .disableTwoFactor(password, code.trim())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busy.set(false);
                    this.disabling.set(false);
                    this.auth.setTwoFactorEnabled(false);
                    this.step.set("off");
                },
                error: (err) => this.fail(err, "Impossible de désactiver. Réessayez."),
            });
    }

    async copy(what: "key" | "codes") {
        const text = what === "key" ? (this.setup()?.secret ?? "") : this.backupCodes().join("\n");

        if (await copyText(text)) {
            this.copied.set(what);
            clearTimeout(this.copiedTimer);
            this.copiedTimer = setTimeout(() => this.copied.set(null), 2000);
        }
    }

    private fail(err: unknown, fallback: string) {
        this.busy.set(false);
        this.error.set(errorText(err, fallback));
    }
}

import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { Icon } from "../../../shared/icon/icon";
import { CreatedShop } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";

// lettres et chiffres faciles à recopier : ni 0/O ni 1/l/I
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

@Component({
    selector: "app-new-shop-dialog",
    imports: [ReactiveFormsModule, Icon],
    templateUrl: "./new-shop-dialog.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./new-shop-dialog.css"],
})
export class NewShopDialog {
    private owner = inject(OwnerShopService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
    private copyButton = viewChild<ElementRef<HTMLButtonElement>>("copyButton");
    private injector = inject(Injector);

    created = output<CreatedShop>();

    form = this.fb.group({
        shopName: ["", [Validators.required, Validators.maxLength(80)]],
        adminName: ["", [Validators.required, Validators.maxLength(100)]],
        email: ["", [Validators.required, Validators.email]],
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
        // vide : pas d'essai
        trialDays: [null as number | null, [Validators.min(1), Validators.max(365)]],
    });

    saving = signal(false);
    error = signal<string | null>(null);
    // après la création : les accès à transmettre à la commerçante, affichés une seule fois
    done = signal<{ shop: CreatedShop; password: string } | null>(null);
    copied = signal(false);
    copyFailed = signal(false);

    credentials = computed(() => {
        const done = this.done();
        if (!done) return "";
        return [
            `Boutique : ${done.shop.name}`,
            `Adresse : ${location.origin}/login`,
            `Email : ${done.shop.admin.email}`,
            `Mot de passe provisoire : ${done.password}`,
            "Pensez à changer le mot de passe à la première connexion (Paramètres, Mot de passe).",
        ].join("\n");
    });

    open() {
        this.form.reset();
        this.error.set(null);
        this.done.set(null);
        this.copied.set(false);
        this.copyFailed.set(false);
        this.dialog().nativeElement.showModal();
        this.dialog().nativeElement.querySelector("input")?.focus();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Échap ferme un <dialog> sans passer par close()
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    // ne rien renvoyer : un gestionnaire qui renvoie false bloque le clic (voir AGENTS.md)
    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    invalid(name: keyof typeof this.form.controls) {
        const control = this.form.controls[name];
        return control.touched && control.invalid;
    }

    generatePassword() {
        const values = crypto.getRandomValues(new Uint32Array(12));
        const password = Array.from(values, (v) => PASSWORD_CHARS[v % PASSWORD_CHARS.length]).join(
            "",
        );
        this.form.controls.password.setValue(password);
        this.form.controls.password.markAsTouched();
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { shopName, adminName, email, password, trialDays } = this.form.getRawValue();
        this.saving.set(true);
        this.error.set(null);

        this.owner
            .createShop({
                shopName: shopName.trim(),
                adminName: adminName.trim(),
                email: email.trim(),
                password,
                ...(trialDays ? { trialDays } : {}),
            })
            .subscribe({
                next: (shop) => {
                    this.saving.set(false);
                    this.done.set({ shop, password });
                    this.created.emit(shop);
                    // le bouton Créer disparaît : le focus passe sur la copie des accès
                    afterNextRender(() => this.copyButton()?.nativeElement.focus(), {
                        injector: this.injector,
                    });
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible de créer la boutique.");
                },
            });
    }

    copy() {
        // le presse-papiers n'existe que sur une adresse sécurisée (https ou localhost)
        const clipboard = navigator.clipboard;
        if (!clipboard) {
            this.copyFailed.set(true);
            return;
        }
        clipboard.writeText(this.credentials()).then(
            () => this.copied.set(true),
            () => this.copyFailed.set(true),
        );
    }
}

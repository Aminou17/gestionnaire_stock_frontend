import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import { Component, ElementRef, computed, inject, signal, viewChild } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { getRoleLabel } from "../../../core/auth/role-label";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { ShopAccount } from "../owned-shop.model";
import { OwnerShopService } from "../owner-shop.service";
import { trialStateOf } from "../trial-state";
import { copyText } from "../../../shared/copy-text";

@Component({
    selector: "app-shop-page",
    imports: [DatePipe, FormsModule, PageHeader, Icon],
    templateUrl: "./shop-page.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./shop-page.css"],
})
export class ShopPage {
    private owner = inject(OwnerShopService);
    private id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id"));

    private suspendDialog = viewChild.required<ElementRef<HTMLDialogElement>>("suspendDialog");
    private passwordDialog = viewChild.required<ElementRef<HTMLDialogElement>>("passwordDialog");

    shop = rxResource({ stream: () => this.owner.getShop(this.id) });

    roleLabel = getRoleLabel;
    trial = computed(() =>
        trialStateOf(this.shop.hasValue() ? this.shop.value().trial_ends_at : null),
    );

    // résultat des actions de la page (lien envoyé, essai modifié...)
    message = signal<{ ok: boolean; text: string } | null>(null);
    busy = signal(false);

    private fail(err: HttpErrorResponse, fallback: string) {
        this.busy.set(false);
        this.message.set({ ok: false, text: err.error?.message ?? fallback });
    }

    // lien envoyé par e-mail à la personne
    sendLink(account: ShopAccount) {
        this.busy.set(true);
        this.message.set(null);

        this.owner.sendResetLink(this.id, account.id).subscribe({
            next: (res) => {
                this.busy.set(false);
                this.message.set({ ok: true, text: res.message });
            },
            error: (err: HttpErrorResponse) => this.fail(err, "Impossible d'envoyer le lien."),
        });
    }

    // mot de passe provisoire : confirmation, puis affichage unique
    tempAccount = signal<ShopAccount | null>(null);
    tempPassword = signal<string | null>(null);
    tempError = signal<string | null>(null);
    copied = signal(false);
    copyFailed = signal(false);

    credentials = computed(() => {
        const account = this.tempAccount();
        const password = this.tempPassword();
        if (!account || !password) return "";

        return [
            `Boutique : ${this.shop.hasValue() ? this.shop.value().name : ""}`,
            `Adresse : ${location.origin}/login`,
            `Email : ${account.email}`,
            `Mot de passe provisoire : ${password}`,
            "Vous devrez choisir votre propre mot de passe à la première connexion.",
        ].join("\n");
    });

    askTempPassword(account: ShopAccount) {
        this.tempAccount.set(account);
        this.tempPassword.set(null);
        this.tempError.set(null);
        this.copied.set(false);
        this.copyFailed.set(false);
        this.passwordDialog().nativeElement.showModal();
    }

    confirmTempPassword() {
        const account = this.tempAccount();
        if (!account) return;

        this.busy.set(true);
        this.tempError.set(null);

        this.owner.setTemporaryPassword(this.id, account.id).subscribe({
            next: (res) => {
                this.busy.set(false);
                this.tempPassword.set(res.password);
            },
            error: (err: HttpErrorResponse) => {
                this.busy.set(false);
                this.tempError.set(err.error?.message ?? "Impossible de créer le mot de passe.");
            },
        });
    }

    closePasswordDialog() {
        if (this.busy()) return;
        this.passwordDialog().nativeElement.close();
    }

    onPasswordCancel(event: Event) {
        if (this.busy()) event.preventDefault();
    }

    // le mot de passe ne reste pas en mémoire une fois la fenêtre fermée
    onPasswordClosed() {
        this.tempPassword.set(null);
        this.tempAccount.set(null);
    }

    copy() {
        copyText(this.credentials()).then((ok) =>
            ok ? this.copied.set(true) : this.copyFailed.set(true),
        );
    }

    // essai : durée à partir d'aujourd'hui, vide pour le retirer
    trialDays = signal<number | null>(null);

    saveTrial() {
        const days = this.trialDays();
        if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
            this.message.set({ ok: false, text: "Indiquez un nombre de jours entre 1 et 365." });
            return;
        }

        this.busy.set(true);
        this.message.set(null);

        this.owner.setTrial(this.id, days).subscribe({
            next: () => {
                this.busy.set(false);
                this.trialDays.set(null);
                this.message.set({
                    ok: true,
                    text:
                        days === null
                            ? "Essai retiré."
                            : `Essai de ${days} jours à partir d'aujourd'hui.`,
                });
                this.shop.reload();
            },
            error: (err: HttpErrorResponse) => this.fail(err, "Impossible de changer l'essai."),
        });
    }

    askSuspend() {
        this.message.set(null);
        this.suspendDialog().nativeElement.showModal();
    }

    closeSuspend() {
        if (this.busy()) return;
        this.suspendDialog().nativeElement.close();
    }

    setStatus(status: "ACTIVE" | "SUSPENDED") {
        this.busy.set(true);
        this.message.set(null);

        this.owner.setStatus(this.id, status).subscribe({
            next: () => {
                this.busy.set(false);
                if (this.suspendDialog().nativeElement.open)
                    this.suspendDialog().nativeElement.close();
                this.shop.reload();
            },
            error: (err: HttpErrorResponse) => {
                this.fail(err, "Impossible de changer le statut.");
                if (this.suspendDialog().nativeElement.open)
                    this.suspendDialog().nativeElement.close();
            },
        });
    }
}

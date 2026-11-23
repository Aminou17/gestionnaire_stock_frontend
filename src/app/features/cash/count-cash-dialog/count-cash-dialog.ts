import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, output, signal, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
    FormControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CashSession } from "../../../core/cash/cash.model";
import { CashSessionService } from "../../../core/cash/cash-session.service";
import { SaleOutboxService } from "../../../core/offline/sale-outbox.service";
import { Icon } from "../../../shared/icon/icon";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// ce qu'il faut savoir pour ouvrir la fenêtre
export interface CountTarget {
    // attendu dans le tiroir ; null quand le comptage est à l'aveugle
    expected: number | null;
    // caisse précise (jour passé non compté, ou comptage à rectifier) ; sans id : la caisse du jour
    sessionId?: number;
    // YYYY-MM-DD, pour dire de quelle journée il s'agit
    sessionDate?: string;
}

@Component({
    selector: "app-count-cash-dialog",
    imports: [DatePipe, Icon, ReactiveFormsModule, FcfaPipe],
    templateUrl: "./count-cash-dialog.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./count-cash-dialog.css"],
})
export class CountCashDialog {
    private cash = inject(CashSessionService);
    // des ventes faites sans internet et pas encore envoyées fausseraient le solde attendu
    protected outbox = inject(SaleOutboxService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    // émis quand la caisse vient d'être comptée
    counted = output();

    form = this.fb.group({
        // vide au départ : pas de 0 à effacer avant de taper
        actualAmount: new FormControl<number | null>(null, {
            validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)],
        }),
        closingNote: ["", [Validators.maxLength(300)]],
    });

    target = signal<CountTarget>({ expected: null });
    // la session renvoyée par le serveur : affichée comme résultat
    result = signal<CashSession | null>(null);
    saving = signal(false);
    error = signal<string | null>(null);

    // l'écart ne s'affiche qu'une fois le montant saisi, pas sur le champ vide
    protected edited = signal(false);
    private typed = toSignal(this.form.controls.actualAmount.valueChanges, { initialValue: null });

    blind = computed(() => this.target().expected === null);

    // écart prévu avant d'enregistrer, quand le solde attendu est connu
    difference = computed(() => {
        const expected = this.target().expected;
        const typed = this.typed();

        if (!this.edited() || expected === null || typed === null) return null;
        if (this.form.controls.actualAmount.invalid) return null;

        return Number(typed) - expected;
    });

    open(target: CountTarget) {
        this.target.set(target);
        this.result.set(null);
        this.saving.set(false);
        this.error.set(null);
        this.edited.set(false);
        this.form.reset();
        this.dialog().nativeElement.showModal();
    }

    close() {
        // pendant l'envoi, la réponse doit arriver sur cette fenêtre ouverte
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    // Échap ferme un <dialog> sans passer par close()
    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    // ne rien renvoyer ici : Angular annule le clic si le gestionnaire renvoie false
    onBackdropClick(event: MouseEvent) {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }

    submit() {
        if (this.outbox.count() > 0) return;

        const { actualAmount, closingNote } = this.form.getRawValue();

        if (this.form.invalid || actualAmount === null) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        this.cash.count(actualAmount, closingNote, this.target().sessionId).subscribe({
            next: (session) => {
                this.saving.set(false);
                this.result.set(session);
                this.counted.emit();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible d'enregistrer le comptage.");
            },
        });
    }
}

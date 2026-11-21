import { CashCounter } from "../cash-counter/cash-counter";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, ElementRef, computed, inject, output, signal, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
    FormControl,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CashSessionService } from "../../../core/cash/cash-session.service";
import { SaleOutboxService } from "../../../core/offline/sale-outbox.service";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

// count : saisie du montant compté ; explain : écart révélé après une clôture à l'aveugle
type Step = "count" | "explain";

@Component({
    selector: "app-close-cash-dialog",
    imports: [CashCounter, ReactiveFormsModule, FcfaPipe],
    templateUrl: "./close-cash-dialog.html",
    styleUrls: ["../../../shared/dialog/dialog.css", "./close-cash-dialog.css"],
})
export class CloseCashDialog {
    private cash = inject(CashSessionService);
    // des ventes faites sans internet et pas encore envoyées fausseraient le solde de la clôture
    protected outbox = inject(SaleOutboxService);
    private fb = inject(NonNullableFormBuilder);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    // émis à chaque changement côté serveur (clôture, puis explication)
    closed = output();

    form = this.fb.group({
        // vide au départ : pas de 0 à effacer avant de taper
        actualAmount: new FormControl<number | null>(null, {
            validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)],
        }),
        closingNote: ["", [Validators.maxLength(300)]],
    });

    step = signal<Step>("count");
    // YYYY-MM-DD de la session à clôturer
    sessionDate = signal("");
    // solde attendu ; null quand la clôture est à l'aveugle
    expected = signal<number | null>(null);
    // session et écart à expliquer à l'étape explain
    sessionId = signal<number | null>(null);
    // caisse d'un autre à fermer (admin seulement)
    closingId = signal<number | null>(null);
    revealed = signal(0);
    // l'écart ne s'affiche qu'une fois le montant saisi, pas sur le 0 de départ
    edited = signal(false);
    saving = signal(false);
    error = signal<string | null>(null);

    blind = computed(() => this.expected() === null);

    private typed = toSignal(this.form.controls.actualAmount.valueChanges, { initialValue: null });

    // écart entre le montant compté et le solde attendu, quand on le connaît
    difference = computed(() => {
        const expected = this.expected();
        const typed = this.typed();
        if (
            !this.edited() ||
            expected === null ||
            typed === null ||
            this.form.controls.actualAmount.invalid
        ) {
            return null;
        }
        return Number(typed) - expected;
    });

    // même 1 F d'écart doit être expliqué
    noteRequired = computed(() => this.difference() !== null && this.difference() !== 0);

    // sessionId : caisse d'un autre, fermée par l'admin
    open(sessionDate: string, expected: number | null, sessionId?: number) {
        this.reset("count");
        this.closingId.set(sessionId ?? null);
        this.sessionDate.set(sessionDate);
        this.expected.set(expected);
        this.dialog().nativeElement.showModal();
    }

    // explication demandée plus tard, depuis la page Caisse ou la fiche de la caisse
    openExplain(sessionId: number, difference: number) {
        this.reset("explain");
        this.sessionId.set(sessionId);
        this.revealed.set(difference);
        this.dialog().nativeElement.showModal();
    }

    private counter = viewChild(CashCounter);

    private reset(step: Step) {
        this.counter()?.reset();
        this.step.set(step);
        this.sessionDate.set("");
        this.expected.set(null);
        this.sessionId.set(null);
        this.revealed.set(0);
        this.saving.set(false);
        this.form.reset();
        this.edited.set(false);
        this.error.set(null);
    }

    close() {
        // pendant l'envoi, la réponse doit arriver sur ce dialogue ouvert (écart à expliquer)
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

    noteMissing() {
        const control = this.form.controls.closingNote;
        const required = this.step() === "explain" || this.noteRequired();
        return required && control.touched && !control.value.trim();
    }

    submit() {
        if (this.step() === "explain") {
            this.explain();
            return;
        }

        if (this.outbox.count() > 0) return;

        const { actualAmount, closingNote } = this.form.getRawValue();

        if (actualAmount === null) {
            this.form.markAllAsTouched();
            this.error.set("Saisissez le montant compté dans le tiroir.");
            return;
        }

        if (this.form.invalid || (this.noteRequired() && !closingNote.trim())) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        // une explication écrite avant de corriger le montant ne doit pas partir
        const note = this.noteRequired() ? closingNote.trim() : "";

        this.cash
            .close(this.sessionDate(), actualAmount, note, this.closingId() ?? undefined)
            .subscribe({
                next: (res) => {
                    this.saving.set(false);
                    this.closed.emit();

                    if (!res.explanation_pending) {
                        this.close();
                        return;
                    }

                    // la caisse est clôturée, le montant ne peut plus changer : on révèle l'écart
                    this.sessionId.set(res.id);
                    this.revealed.set(res.difference);
                    this.form.controls.closingNote.reset();
                    this.step.set("explain");
                },
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "Impossible de clôturer la caisse.");
                },
            });
    }

    private explain() {
        const note = this.form.getRawValue().closingNote.trim();
        const id = this.sessionId();

        if (!note || id === null) {
            this.form.controls.closingNote.markAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        this.cash.addClosingNote(id, note).subscribe({
            next: () => {
                this.saving.set(false);
                this.close();
                this.closed.emit();
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.error.set(err.error?.message ?? "Impossible d'enregistrer l'explication.");
            },
        });
    }
}

import { Component, ElementRef, OnDestroy, viewChild } from "@angular/core";

@Component({
    selector: "app-unsaved-dialog",
    templateUrl: "./unsaved-dialog.html",
    styleUrl: "./unsaved-dialog.css",
})
export class UnsavedDialog implements OnDestroy {
    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");

    private resolve: ((leave: boolean) => void) | null = null;

    // vrai si l'utilisateur choisit de quitter la page
    ask() {
        // une seconde demande ne doit pas laisser la première sans réponse
        this.resolve?.(false);
        this.dialog().nativeElement.showModal();

        return new Promise<boolean>((resolve) => {
            this.resolve = resolve;
        });
    }

    answer(leave: boolean) {
        this.dialog().nativeElement.close();
        this.resolve?.(leave);
        this.resolve = null;
    }

    // Échap et clic à côté de la boîte reviennent à rester sur la page
    onCancel(event: Event) {
        event.preventDefault();
        this.answer(false);
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.answer(false);
    }

    ngOnDestroy() {
        this.resolve?.(false);
    }
}

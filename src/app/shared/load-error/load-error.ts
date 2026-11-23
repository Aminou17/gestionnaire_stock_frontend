import { Component, input, output } from "@angular/core";

// Message d'erreur de chargement avec un bouton pour réessayer
@Component({
    selector: "app-load-error",
    template: `
        <div class="load-error" role="alert">
            <p>{{ message() }}</p>
            <button type="button" class="btn btn-outline btn-sm" (click)="retry.emit()">
                Réessayer
            </button>
        </div>
    `,
    styles: `
        .load-error {
            display: grid;
            justify-items: center;
            gap: 12px;
            padding: 32px 16px;
            text-align: center;
            font-size: var(--fs-body);
            color: var(--text-muted);
        }

        p {
            margin: 0;
        }
    `,
})
export class LoadError {
    message = input("Impossible de charger les données.");
    retry = output<void>();
}

import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { PageHeader } from "../../layout/page-header/page-header";

// Page provisoire pour les liens du menu pas encore développés
@Component({
    selector: "app-coming-soon",
    imports: [PageHeader, RouterLink],
    template: `
        <app-page-header [title]="title" />
        <div class="card box">
            <h2>Page en cours de développement</h2>
            <p class="muted">Cette section arrive bientôt.</p>
            <a routerLink="/dashboard" class="btn btn-outline">Retour au tableau de bord</a>
        </div>
    `,
    styles: `
        .box {
            padding: 48px 24px;
            text-align: center;
        }
        h2 {
            margin: 0 0 8px;
            font-size: 18px;
        }
        p {
            margin: 0 0 20px;
        }
    `,
})
export class ComingSoon {
    title = inject(ActivatedRoute).snapshot.data["heading"] ?? "";
}
